import { DataSource, EntityTarget, ObjectLiteral } from "typeorm";

// ─── Environment ──────────────────────────────────────────────────────────────

export type SeederEnvironment =
  | "dev"
  | "test"
  | "staging"
  | "production"
  | "*"
  | string;

// ─── Factory ──────────────────────────────────────────────────────────────────

export type FieldValue<T> =
  | T
  | (() => T)
  | RelationDefinition<any>
  | SequenceDefinition<T>
  | OneOfDefinition<T>;

export type FactoryFields<T extends ObjectLiteral> = {
  [K in keyof T]?: FieldValue<T[K]>;
};

export interface FactoryDefinition<T extends ObjectLiteral> {
  target: EntityTarget<T>;
  fields: FactoryFields<T>;
  _type: "factory";
}

// ─── Relations ────────────────────────────────────────────────────────────────

export interface HasManyDefinition<T extends ObjectLiteral> {
  _type: "hasMany";
  target: EntityTarget<T>;
  count: number;
  fields: FactoryFields<T>;
}

export interface BelongsToDefinition<T extends ObjectLiteral> {
  _type: "belongsTo";
  target: EntityTarget<T>;
  resolve: "first" | "last" | "random" | "create";
  fields?: FactoryFields<T>;
}

export interface OneOfDefinition<T> {
  _type: "oneOf";
  values: T[];
}

export interface SequenceDefinition<T> {
  _type: "sequence";
  fn: (index: number) => T;
}

export type RelationDefinition<T extends ObjectLiteral> =
  | HasManyDefinition<T>
  | BelongsToDefinition<T>;

// ─── Seeder ───────────────────────────────────────────────────────────────────

export interface SeederDecoratorOptions {
  env?: SeederEnvironment | SeederEnvironment[];
  order?: number;
  name?: string;
}

export interface SeedDecoratorOptions {
  count?: number;
  truncateBefore?: boolean;
}

export interface SeederMetadata {
  target: Function;
  options: SeederDecoratorOptions;
  seeds: SeedPropertyMetadata[];
}

export interface SeedPropertyMetadata {
  propertyKey: string;
  entity: EntityTarget<any>;
  options: SeedDecoratorOptions;
}

// ─── Runner ───────────────────────────────────────────────────────────────────

export interface SeederRunOptions {
  env?: string;
  seeder?: string;
  dryRun?: boolean;
  count?: number;
  silent?: boolean;
  idempotent?: boolean;
  dataSource?: DataSource;
}

export interface SeederResult {
  seederName: string;
  entitiesCreated: number;
  skipped: boolean;
  dryRun: boolean;
  duration: number;
}
