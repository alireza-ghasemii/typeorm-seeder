import { createHash } from "crypto";
import { DataSource, Table } from "typeorm";

const HISTORY_TABLE = "seeder_history";

export interface SeederHistoryRecord {
  id?: number;
  seeder_name: string;
  env: string;
  executed_at: Date;
  entity_count: number;
  checksum: string;
}

export class IdempotencyTracker {
  private initialized = false;

  constructor(private readonly dataSource: DataSource) {}

  async init(): Promise<void> {
    if (this.initialized) return;

    const queryRunner = this.dataSource.createQueryRunner();

    try {
      const hasTable = await queryRunner.hasTable(HISTORY_TABLE);

      if (!hasTable) {
        await queryRunner.createTable(
          new Table({
          name: HISTORY_TABLE,
          columns: [
            {
              name: "id",
              type: this.primaryGeneratedColumnType(),
              isPrimary: true,
              isGenerated: true,
              generationStrategy: "increment",
            },
            {
              name: "seeder_name",
              type: "varchar",
              length: "255",
              isNullable: false,
            },
            {
              name: "env",
              type: "varchar",
              length: "50",
              isNullable: false,
            },
            {
              name: "executed_at",
              type: this.timestampColumnType(),
              isNullable: false,
              default: this.currentTimestampDefault(),
            },
            {
              name: "entity_count",
              type: "int",
              isNullable: false,
              default: 0,
            },
            {
              name: "checksum",
              type: "varchar",
              length: "64",
              isNullable: false,
            },
          ],
          uniques: [
            {
              name: "UQ_seeder_history_name_env",
              columnNames: ["seeder_name", "env"],
            },
          ],
          }),
          true,
        );
      }
    } finally {
      await queryRunner.release();
    }

    this.initialized = true;
  }

  async hasRun(
    seederName: string,
    env: string,
    checksum: string,
  ): Promise<boolean> {
    await this.init();

    const row = await this.dataSource
      .createQueryBuilder()
      .select("history.checksum", "checksum")
      .from(HISTORY_TABLE, "history")
      .where("history.seeder_name = :seederName", { seederName })
      .andWhere("history.env = :env", { env })
      .getRawOne<{ checksum: string }>();

    if (!row) return false;

    if (row.checksum !== checksum) {
      console.log(
        `  ⚠️  ${seederName}: checksum changed (seeder was modified), will re-run`,
      );
      return false;
    }

    return true;
  }

  async markAsRun(
    seederName: string,
    env: string,
    entityCount: number,
    checksum: string,
  ): Promise<void> {
    await this.init();

    const existing = await this.dataSource
      .createQueryBuilder()
      .select("history.id", "id")
      .from(HISTORY_TABLE, "history")
      .where("history.seeder_name = :seederName", { seederName })
      .andWhere("history.env = :env", { env })
      .getRawOne<{ id: number }>();

    if (existing) {
      await this.dataSource
        .createQueryBuilder()
        .update(HISTORY_TABLE)
        .set({
          executed_at: () => this.currentTimestampDefault(),
          entity_count: entityCount,
          checksum,
        })
        .where("seeder_name = :seederName", { seederName })
        .andWhere("env = :env", { env })
        .execute();
      return;
    }

    await this.dataSource
      .createQueryBuilder()
      .insert()
      .into(HISTORY_TABLE)
      .values({
        seeder_name: seederName,
        env,
        entity_count: entityCount,
        checksum,
      })
      .execute();
  }

  async getHistory(): Promise<SeederHistoryRecord[]> {
    await this.init();

    return this.dataSource
      .createQueryBuilder()
      .select("*")
      .from(HISTORY_TABLE, "history")
      .orderBy("history.executed_at", "DESC")
      .getRawMany<SeederHistoryRecord>();
  }

  async reset(seederName?: string, env?: string): Promise<void> {
    await this.init();

    const query = this.dataSource.createQueryBuilder().delete().from(HISTORY_TABLE);

    if (seederName && env) {
      await query
        .where("seeder_name = :seederName", { seederName })
        .andWhere("env = :env", { env })
        .execute();
      return;
    }

    if (seederName) {
      await query.where("seeder_name = :seederName", { seederName }).execute();
      return;
    }

    await query.execute();
  }

  private primaryGeneratedColumnType(): string {
    const type = this.dataSource.options.type;
    if (type === "postgres" || type === "cockroachdb") return "int";
    if (type === "sqlite" || type === "better-sqlite3") return "integer";
    return "int";
  }

  private timestampColumnType(): string {
    const type = this.dataSource.options.type;
    if (type === "mysql" || type === "mariadb") return "datetime";
    return "timestamp";
  }

  private currentTimestampDefault(): string {
    const type = this.dataSource.options.type;
    if (type === "mssql") return "GETDATE()";
    return "CURRENT_TIMESTAMP";
  }
}

export function computeChecksum(
  seederName: string,
  factorySnapshot: object,
): string {
  const content = stableStringify({ seederName, snapshot: factorySnapshot });
  return createHash("sha256").update(content).digest("hex");
}

function stableStringify(value: unknown): string {
  if (typeof value === "function") return value.toString();
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;

  const entries = Object.entries(value as Record<string, unknown>).sort(
    ([a], [b]) => a.localeCompare(b),
  );

  return `{${entries
    .map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`)
    .join(",")}}`;
}
