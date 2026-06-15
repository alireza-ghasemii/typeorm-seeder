import { EntityTarget, ObjectLiteral } from "typeorm";
import {
  HasManyDefinition,
  BelongsToDefinition,
  OneOfDefinition,
  SequenceDefinition,
  FactoryFields,
} from "../core/types";

/**
 * N رکورد مرتبط می‌سازه و به صورت خودکار به parent وصل می‌کنه
 *
 * @example
 * posts: hasMany(Post, {
 *   count: 3,
 *   fields: {
 *     title: () => faker.lorem.sentence(),
 *   }
 * })
 */
export function hasMany<T extends ObjectLiteral>(
  target: EntityTarget<T>,
  options: {
    count: number;
    fields: FactoryFields<T>;
  },
): HasManyDefinition<T> {
  return {
    _type: "hasMany",
    target,
    count: options.count,
    fields: options.fields,
  };
}

/**
 * یه رکورد parent رو resolve می‌کنه یا می‌سازه
 *
 * @example
 * author: belongsTo(User, { resolve: 'first' })
 * // اگر User ای در DB هست، اولین رو برمی‌گردونه
 * // اگر نه، یه User جدید می‌سازه
 *
 * author: belongsTo(User, {
 *   resolve: 'create',
 *   fields: { name: () => faker.person.fullName() }
 * })
 */
export function belongsTo<T extends ObjectLiteral>(
  target: EntityTarget<T>,
  options: {
    resolve: "first" | "last" | "random" | "create";
    fields?: FactoryFields<T>;
  },
): BelongsToDefinition<T> {
  return {
    _type: "belongsTo",
    target,
    resolve: options.resolve,
    fields: options.fields,
  };
}

/**
 * یه مقدار تصادفی از آرایه انتخاب می‌کنه
 *
 * @example
 * role: oneOf(['admin', 'user', 'moderator'])
 * status: oneOf(['active', 'inactive', 'pending'])
 */
export function oneOf<T>(values: T[]): OneOfDefinition<T> {
  return { _type: "oneOf", values };
}

/**
 * مقدارهای incremental و unique می‌سازه
 *
 * @example
 * email: sequence((i) => `user_${i}@example.com`)
 * username: sequence((i) => `user${i.toString().padStart(4, '0')}`)
 */
export function sequence<T>(fn: (index: number) => T): SequenceDefinition<T> {
  return { _type: "sequence", fn };
}
