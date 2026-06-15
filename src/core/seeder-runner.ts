import { DataSource, Repository, EntityTarget, ObjectLiteral } from "typeorm";
import {
  SeederRunOptions,
  SeederResult,
  SeederMetadata,
  FactoryDefinition,
} from "./types";
import {
  buildEntity,
  isHasManyDef,
  isBelongsToDef,
  resolveField,
} from "./factory";
import { getSeederMetadata } from "../decorators/seeder.decorator";
import { matchesEnvironment } from "../environments/env-filter";
import { IdempotencyTracker, computeChecksum } from "./idempotent";

export class SeederRunner {
  private registry: Function[] = [];
  private tracker: IdempotencyTracker;

  constructor(private readonly dataSource: DataSource) {
    this.tracker = new IdempotencyTracker(dataSource);
  }

  register(seeders: Function[]): this {
    this.registry.push(...seeders);
    return this;
  }

  async run(options: Partial<SeederRunOptions> = {}): Promise<SeederResult[]> {
    const env = options.env ?? process.env.SEEDER_ENV ?? "dev";
    const results: SeederResult[] = [];

      const targets = this.registry
      .filter((seeder) => {
        const meta = getSeederMetadata(seeder);
        if (!meta) return false;
        if (options.seeder && this.getSeederName(meta) !== options.seeder)
          return false;
        return matchesEnvironment(meta.options.env, env);
      })
      .sort((a, b) => {
        const metaA = getSeederMetadata(a)!;
        const metaB = getSeederMetadata(b)!;
        return (metaA.options.order ?? 0) - (metaB.options.order ?? 0);
      });

    for (const SeederClass of targets) {
      const meta = getSeederMetadata(SeederClass)!;
      const seederName = this.getSeederName(meta);
      const start = Date.now();

      if (!options.silent) console.log(`\n🌱 Running ${seederName}...`);

      // ─── Idempotency Check ────────────────────────────────────────────────
      const instance = new (SeederClass as any)();
      const checksum = computeChecksum(seederName, instance);

      if (options.idempotent && !options.dryRun) {
        const alreadyRan = await this.tracker.hasRun(seederName, env, checksum);
        if (alreadyRan) {
          if (!options.silent)
            console.log(`  ⏭️  ${seederName}: already ran — skipping`);
          results.push({
            seederName,
            entitiesCreated: 0,
            skipped: true,
            dryRun: false,
            duration: Date.now() - start,
          });
          continue;
        }
      }
      // ─────────────────────────────────────────────────────────────────────

      let entitiesCreated = 0;

      if (!options.dryRun) {
        entitiesCreated = await this.executeSeed(instance, meta, options);

        if (options.idempotent) {
          await this.tracker.markAsRun(
            seederName,
            env,
            entitiesCreated,
            checksum,
          );
        }
      }

      const result: SeederResult = {
        seederName,
        entitiesCreated,
        skipped: false,
        dryRun: !!options.dryRun,
        duration: Date.now() - start,
      };

      results.push(result);

      if (!options.silent) {
        console.log(
          `  ✅ ${seederName}: ${result.dryRun ? "[dry-run]" : `${entitiesCreated} records`} (${result.duration}ms)`,
        );
      }
    }

    return results;
  }

  private async executeSeed(
    instance: any,
    meta: SeederMetadata,
    options: Partial<SeederRunOptions>,
  ): Promise<number> {
    let total = 0;

    for (const seedMeta of meta.seeds) {
      const factoryDef: FactoryDefinition<any> = instance[seedMeta.propertyKey];
      if (!factoryDef || factoryDef._type !== "factory") continue;

      const count = options.count ?? seedMeta.options.count ?? 10;
      const EntityClass = this.resolveEntityClass(factoryDef.target);
      const repo: Repository<any> = this.dataSource.getRepository(
        factoryDef.target,
      );

      if (seedMeta.options.truncateBefore) {
        await repo.clear();
      }

      const entities = await this.buildRootEntities(
        factoryDef,
        count,
        EntityClass,
      );
      const saved = await repo.save(entities);
      const relationCount = await this.persistHasManyRelations(
        factoryDef,
        saved,
      );
      total += saved.length + relationCount;
    }

    return total;
  }

  private async buildRootEntities<T extends ObjectLiteral>(
    factoryDef: FactoryDefinition<T>,
    count: number,
    EntityClass: new () => T,
  ): Promise<T[]> {
    const results: T[] = [];

    for (let i = 0; i < count; i++) {
      const entity = buildEntity(factoryDef, i, EntityClass);

      for (const [key, value] of Object.entries(factoryDef.fields)) {
        if (isHasManyDef(value)) {
          continue;
        }

        if (isBelongsToDef(value)) {
          const parentRepo = this.dataSource.getRepository(value.target);
          let parent: any;

          if (value.resolve === "first") {
            parent = await parentRepo.findOne({ where: {} });
          } else if (value.resolve === "last") {
            parent = await parentRepo.findOne({
              where: {},
              order: { id: "DESC" } as any,
            });
          } else if (value.resolve === "random") {
            const all = await parentRepo.find();
            parent = all[Math.floor(Math.random() * all.length)];
          }

          if (!parent && (value.resolve !== "create" || !value.fields)) {
            throw new Error(
              `[typeorm-seeder] belongsTo: could not resolve ${String(value.target)} — no records found`,
            );
          }

          if (!parent && value.fields) {
            const parentClass = this.resolveEntityClass(value.target);
            parent = new parentClass();
            for (const [pk, pv] of Object.entries(value.fields)) {
              (parent as any)[pk] = resolveField(pv, i);
            }
            parent = await parentRepo.save(parent);
          }

          (entity as any)[key] = parent;
        }
      }

      results.push(entity);
    }

    return results;
  }

  private resolveEntityClass(target: EntityTarget<any>): new () => any {
    if (typeof target === "function") return target as new () => any;
    throw new Error(
      `[typeorm-seeder] Cannot resolve entity class from: ${String(target)}`,
    );
  }

  private async persistHasManyRelations<T extends ObjectLiteral>(
    factoryDef: FactoryDefinition<T>,
    parents: T[],
  ): Promise<number> {
    let total = 0;

    for (const parent of parents) {
      for (const [key, value] of Object.entries(factoryDef.fields)) {
        if (!isHasManyDef(value)) continue;

        const childClass = this.resolveEntityClass(value.target);
        const childRepo = this.dataSource.getRepository(value.target);
        const inverseProperty = this.getInverseRelationProperty(
          factoryDef.target,
          key,
        );

        const children: any[] = [];
        for (let j = 0; j < value.count; j++) {
          const child = new childClass();
          for (const [ck, cv] of Object.entries(value.fields)) {
            (child as any)[ck] = resolveField(cv, j);
          }
          if (inverseProperty) {
            child[inverseProperty] = parent;
          }
          children.push(child);
        }

        const saved = await childRepo.save(children);
        (parent as any)[key] = saved;
        total += saved.length;
      }
    }

    return total;
  }

  private getInverseRelationProperty(
    target: EntityTarget<any>,
    propertyName: string,
  ): string | undefined {
    try {
      const relation = this.dataSource
        .getMetadata(target)
        .findRelationWithPropertyPath(propertyName);
      return relation?.inverseRelation?.propertyName;
    } catch {
      return undefined;
    }
  }

  private getSeederName(meta: SeederMetadata): string {
    return meta.options.name ?? meta.target.name;
  }
}
