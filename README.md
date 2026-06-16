# 🌱 typeorm-seeder

> Declarative, type-safe, relation-aware seeding for TypeORM — built for NestJS and beyond.

[![npm version](https://img.shields.io/npm/v/typeorm-seeder)](https://npmjs.com/package/typeorm-seeder)
[![license](https://img.shields.io/npm/l/typeorm-seeder)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)

---

## 🧨 The Problem

Every NestJS + TypeORM project eventually has a `seed.ts` file that looks like this:

```ts
// 😵 the classic mess
const user = new User();
user.name = "Test User";
user.email = "test@example.com";
await userRepo.save(user);

const post = new Post();
post.title = "Hello";
post.author = user; // manually wiring relations
await postRepo.save(post);

// ... 200 more lines of this
```

**Problems with this approach:**

- No type safety — wrong field names silently fail
- Relations wired manually, in the right order, every time
- No difference between `dev`, `test`, and `staging` data
- No CLI — you run it by commenting/uncommenting code
- Runs every time even if data already exists
- Faker calls scattered everywhere with no reuse

---

## ✅ The Solution

```ts
@Seeder({ env: ["dev", "staging"] })
export class UserSeeder {
  @Seed(User, { count: 10 })
  users = factory(User, {
    name: () => faker.person.fullName(),
    email: () => faker.internet.email(),
    role: oneOf(["admin", "user", "moderator"]),
    posts: hasMany(Post, {
      count: 3,
      fields: {
        title: () => faker.lorem.sentence(),
        body: () => faker.lorem.paragraphs(2),
      },
    }),
  });
}
```

```bash
pnpm seed:run --seeder UserSeeder --env dev
```

That's it. Relations resolved automatically. Type-safe. Environment-aware.

---

## 📦 Installation

```bash
pnpm add @alireza_ghasemi/typeorm-seeder
pnpm add -D @faker-js/faker
```

---

## 🚀 Quick Start

### 1. Register the module (NestJS)

```ts
// app.module.ts
@Module({
  imports: [
    SeederModule.forRoot({
      dataSource: AppDataSource,
      seedersPath: "./src/seeders",
    }),
  ],
})
export class AppModule {}
```

### 2. Define a factory

```ts
// seeders/factories/user.factory.ts
import { factory } from "@alireza_ghasemi/typeorm-seeder";
import { faker } from "@faker-js/faker";

export const userFactory = factory(User, {
  name: () => faker.person.fullName(),
  email: () => faker.internet.email(),
  age: () => faker.number.int({ min: 18, max: 65 }),
});
```

### 3. Define a seeder

```ts
// seeders/user.seeder.ts
import { Seeder, Seed, hasMany, oneOf } from "@alireza_ghasemi/typeorm-seeder";

@Seeder({ env: ["dev", "staging"] })
export class UserSeeder {
  @Seed(User, { count: 20 })
  users = factory(User, {
    name: () => faker.person.fullName(),
    email: () => faker.internet.email(),
    role: oneOf(["admin", "user"]),
    posts: hasMany(Post, {
      count: 3,
      fields: {
        title: () => faker.lorem.sentence(),
      },
    }),
  });
}
```

### 4. Run via CLI

```bash
# Run all seeders for current env
pnpm seed:run

# Run a specific seeder
pnpm seed:run --seeder UserSeeder

# Target a specific environment
pnpm seed:run --env staging

# Dry run — shows what would be inserted without touching DB
pnpm seed:run --dry-run
```

---

## 🔗 Relations API

### `hasMany(Entity, options)`

Creates N related records and wires them automatically:

```ts
posts: hasMany(Post, {
  count: 5,
  fields: {
    title: () => faker.lorem.sentence(),
  },
});
```

### `belongsTo(Entity, options)`

Resolves or creates a parent record:

```ts
author: belongsTo(User, {
  resolve: "first", // uses first existing User in DB, or creates one
});
```

### `oneOf(values)`

Picks a random value from an array:

```ts
role: oneOf(["admin", "user", "moderator"]);
status: oneOf(["active", "inactive"]);
```

### `sequence(fn)`

Generates incremental, unique values:

```ts
email: sequence((i) => `user_${i}@example.com`);
```

---

## 🌍 Environment Support

Seeders declare which environments they belong to:

```ts
@Seeder({ env: ['dev'] })              // only dev
@Seeder({ env: ['dev', 'staging'] })   // dev and staging
@Seeder({ env: '*' })                  // all environments
```

Set the current environment via:

```bash
# .env
SEEDER_ENV=staging

# or CLI flag
pnpm seed:run --env staging
```

---

## 🧪 Testing Support

Works seamlessly inside Jest with TypeORM's test DataSource:

```ts
// user.service.spec.ts
beforeAll(async () => {
  await seeder.run(UserSeeder, { count: 5 });
});

it("should return all users", async () => {
  const users = await userService.findAll();
  expect(users).toHaveLength(5);
});
```

---

## 🖥️ CLI Reference

```
Usage: seed [command] [options]

Commands:
  run       Run seeders
  list      List all registered seeders
  reset     Truncate all seeded tables (dev only)

Options:
  --seeder   Name of seeder class to run        [string]
  --env      Target environment                 [string]
  --count    Override entity count              [number]
  --dry-run  Preview without DB writes         [boolean]
  --silent   Suppress output                   [boolean]
```

---

## 🗂️ Recommended Project Structure

```
src/
└── seeders/
    ├── factories/
    │   ├── user.factory.ts
    │   └── post.factory.ts
    ├── user.seeder.ts
    ├── post.seeder.ts
    └── index.ts        ← barrel export
```

---

## 🛣️ Roadmap

- [x] Core factory & seeder API
- [x] Relation support (hasMany, belongsTo)
- [x] Environment-aware execution
- [x] CLI
- [ ] Idempotent seeding (skip if already exists)
- [ ] Seed order dependency graph
- [ ] Faker locale support
- [ ] Plugin: Prisma adapter
- [ ] GUI dashboard (NestJS DevTools integration)

---

## 🤝 Contributing

```bash
git clone https://github.com/alireza-ghasemii/typeorm-seeder.git
pnpm install
pnpm test
```

---

## 📄 License

MIT © [Alireza Ghasemi]
