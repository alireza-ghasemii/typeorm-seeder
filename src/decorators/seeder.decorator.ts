import "reflect-metadata";
import { EntityTarget, ObjectLiteral } from "typeorm";
import {
  SeederDecoratorOptions,
  SeedDecoratorOptions,
  SeederMetadata,
} from "../core/types";

const SEEDER_METADATA_KEY = "typeorm-seeder:metadata";
const SEED_PROPERTY_KEY = "typeorm-seeder:seed-properties";

/**
 * یه class رو به عنوان Seeder علامت‌گذاری می‌کنه
 *
 * @example
 * @Seeder({ env: ['dev', 'staging'] })
 * export class UserSeeder { ... }
 *
 * @Seeder({ env: '*', order: 1 })  // همه محیط‌ها، اول اجرا بشه
 * export class BaseSeeder { ... }
 */
export function Seeder(options: SeederDecoratorOptions = {}): ClassDecorator {
  return (target: Function) => {
    const existing: SeederMetadata = Reflect.getMetadata(
      SEEDER_METADATA_KEY,
      target,
    ) || {
      target,
      options: {},
      seeds: [],
    };

    Reflect.defineMetadata(
      SEEDER_METADATA_KEY,
      { ...existing, options: { env: "*", order: 0, ...options } },
      target,
    );
  };
}

/**
 * یه property رو در Seeder به عنوان seed data تعریف می‌کنه
 *
 * @example
 * @Seed(User, { count: 10 })
 * users = factory(User, { ... })
 *
 * @Seed(Post, { count: 20, truncateBefore: true })
 * posts = factory(Post, { ... })
 */
export function Seed<T extends ObjectLiteral>(
  entity: EntityTarget<T>,
  options: SeedDecoratorOptions = {},
) {
  return (target: Object, propertyKey: string | symbol) => {
    const constructor = target.constructor;
    const seeds = Reflect.getMetadata(SEED_PROPERTY_KEY, constructor) || [];

    seeds.push({
      propertyKey: propertyKey.toString(),
      entity,
      options: { count: 10, truncateBefore: false, ...options },
    });

    Reflect.defineMetadata(SEED_PROPERTY_KEY, seeds, constructor);

    // metadata روی class هم merge کن
    const meta: SeederMetadata = Reflect.getMetadata(
      SEEDER_METADATA_KEY,
      constructor,
    ) || {
      target: constructor,
      options: { env: "*", order: 0 },
      seeds: [],
    };

    Reflect.defineMetadata(
      SEEDER_METADATA_KEY,
      { ...meta, seeds },
      constructor,
    );
  };
}

// ─── Metadata Helpers ─────────────────────────────────────────────────────────

export function getSeederMetadata(
  target: Function,
): SeederMetadata | undefined {
  return Reflect.getMetadata(SEEDER_METADATA_KEY, target);
}

export function isSeeder(target: Function): boolean {
  return !!Reflect.getMetadata(SEEDER_METADATA_KEY, target);
}
