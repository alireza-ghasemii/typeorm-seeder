import { EntityTarget, ObjectLiteral } from "typeorm";
import {
  FactoryDefinition,
  FactoryFields,
  HasManyDefinition,
  BelongsToDefinition,
  OneOfDefinition,
  SequenceDefinition,
} from "./types";

/**
 * تعریف factory برای یه entity
 *
 * @example
 * const userFactory = factory(User, {
 *   name: () => faker.person.fullName(),
 *   email: () => faker.internet.email(),
 * })
 */
export function factory<T extends ObjectLiteral>(
  target: EntityTarget<T>,
  fields: FactoryFields<T>,
): FactoryDefinition<T> {
  return { target, fields, _type: "factory" };
}

/**
 * مقدار field رو resolve می‌کنه (function، مقدار ثابت، یا relation)
 */
export function resolveField<T>(value: any, index: number): T {
  if (value === null || value === undefined) return value;

  if (isSequenceDef(value)) return value.fn(index) as T;
  if (isOneOfDef(value))
    return value.values[Math.floor(Math.random() * value.values.length)] as T;
  if (typeof value === "function") return (value as () => T)();

  return value as T;
}

/**
 * یه instance از entity رو بدون ذخیره در DB می‌سازه
 * (برای resolve کردن مقادیر ساده — بدون relations)
 */
export function buildEntity<T extends ObjectLiteral>(
  factory: FactoryDefinition<T>,
  index: number,
  EntityClass: new () => T,
): T {
  const instance = new EntityClass();

  for (const [key, value] of Object.entries(factory.fields)) {
    if (isHasManyDef(value) || isBelongsToDef(value))
      continue; // relations جداگانه handle می‌شن
    (instance as any)[key] = resolveField(value, index);
  }

  return instance;
}

// ─── Type Guards ──────────────────────────────────────────────────────────────

export function isHasManyDef(val: any): val is HasManyDefinition<any> {
  return val && val._type === "hasMany";
}

export function isBelongsToDef(val: any): val is BelongsToDefinition<any> {
  return val && val._type === "belongsTo";
}

export function isOneOfDef(val: any): val is OneOfDefinition<any> {
  return val && val._type === "oneOf";
}

export function isSequenceDef(val: any): val is SequenceDefinition<any> {
  return val && val._type === "sequence";
}
