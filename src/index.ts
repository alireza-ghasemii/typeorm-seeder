// ─── Decorators ───────────────────────────────────────────────────────────────
export {
  Seeder,
  Seed,
  getSeederMetadata,
  isSeeder,
} from "./decorators/seeder.decorator";

// ─── Factory ──────────────────────────────────────────────────────────────────
export { factory, resolveField, buildEntity } from "./core/factory";

// ─── Relations ────────────────────────────────────────────────────────────────
export { hasMany, belongsTo, oneOf, sequence } from "./relations/index";

// ─── Runner ───────────────────────────────────────────────────────────────────
export { SeederRunner } from "./core/seeder-runner";

// ─── Idempotency ──────────────────────────────────────────────────────────────
export { IdempotencyTracker, computeChecksum } from "./core/idempotent";

// ─── NestJS Integration ───────────────────────────────────────────────────────
export { SeederModule } from "./nestjs/seeder.module";
export { SeederService } from "./nestjs/seeder.service";
export type { SeederModuleOptions } from "./nestjs/seeder.module";

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  SeederEnvironment,
  FactoryDefinition,
  FactoryFields,
  FieldValue,
  HasManyDefinition,
  BelongsToDefinition,
  OneOfDefinition,
  SequenceDefinition,
  SeederMetadata,
  SeederRunOptions,
  SeederResult,
} from "./core/types";
