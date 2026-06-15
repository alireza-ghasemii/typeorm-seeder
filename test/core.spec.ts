import { describe, expect, it } from "@jest/globals";
import { buildEntity, factory, resolveField } from "../src/core/factory";
import { computeChecksum } from "../src/core/idempotent";
import {
  Seed,
  Seeder,
  getSeederMetadata,
} from "../src/decorators/seeder.decorator";
import { matchesEnvironment } from "../src/environments/env-filter";
import { belongsTo, hasMany, oneOf, sequence } from "../src/relations";

// ─── Mock Entities ────────────────────────────────────────────────────────────

class User {
  id!: number;
  name!: string;
  email!: string;
  role!: string;
  posts!: Post[];
}

class Post {
  id!: number;
  title!: string;
  authorId!: number;
}

// ─── factory() ────────────────────────────────────────────────────────────────

describe("factory()", () => {
  it("should return a FactoryDefinition with correct type", () => {
    const def = factory(User, { name: () => "John" });
    expect(def._type).toBe("factory");
    expect(def.target).toBe(User);
  });

  it("should store fields correctly", () => {
    const nameFn = () => "Alice";
    const def = factory(User, { name: nameFn });
    expect(def.fields.name).toBe(nameFn);
  });
});

// ─── buildEntity() ────────────────────────────────────────────────────────────

describe("buildEntity()", () => {
  it("should resolve function fields", () => {
    const def = factory(User, {
      name: () => "Bob",
      email: () => "bob@test.com",
    });
    const entity = buildEntity(def, 0, User);
    expect(entity.name).toBe("Bob");
    expect(entity.email).toBe("bob@test.com");
  });

  it("should resolve static value fields", () => {
    const def = factory(User, { role: "admin" as any });
    const entity = buildEntity(def, 0, User);
    expect(entity.role).toBe("admin");
  });

  it("should skip relation fields (hasMany/belongsTo)", () => {
    const def = factory(User, {
      name: () => "Dan",
      posts: hasMany(Post, { count: 3, fields: { title: () => "Hello" } }),
    });
    const entity = buildEntity(def, 0, User);
    expect(entity.name).toBe("Dan");
    expect(entity.posts).toBeUndefined(); // relations جداگانه resolve می‌شن
  });
});

// ─── Relations ────────────────────────────────────────────────────────────────

describe("oneOf()", () => {
  it("should return a value from the array", () => {
    const values = ["admin", "user", "moderator"];
    const def = oneOf(values);
    expect(def._type).toBe("oneOf");

    const resolved = resolveField(def, 0);
    expect(values).toContain(resolved);
  });

  it("should never return a value outside the array", () => {
    const values = ["a", "b", "c"];
    const def = oneOf(values);

    for (let i = 0; i < 50; i++) {
      expect(values).toContain(resolveField(def, i));
    }
  });
});

describe("sequence()", () => {
  it("should call fn with incremental index", () => {
    const def = sequence((i) => `user_${i}@example.com`);
    expect(resolveField(def, 0)).toBe("user_0@example.com");
    expect(resolveField(def, 5)).toBe("user_5@example.com");
    expect(resolveField(def, 99)).toBe("user_99@example.com");
  });
});

describe("hasMany()", () => {
  it("should return a HasManyDefinition", () => {
    const def = hasMany(Post, { count: 5, fields: { title: () => "T" } });
    expect(def._type).toBe("hasMany");
    expect(def.target).toBe(Post);
    expect(def.count).toBe(5);
  });
});

describe("belongsTo()", () => {
  it("should return a BelongsToDefinition with resolve strategy", () => {
    const def = belongsTo(User, { resolve: "first" });
    expect(def._type).toBe("belongsTo");
    expect(def.resolve).toBe("first");
  });
});

// ─── @Seeder / @Seed Decorators ───────────────────────────────────────────────

describe("@Seeder decorator", () => {
  it("should attach metadata to class", () => {
    @Seeder({ env: "dev", order: 1 })
    class TestSeeder {}

    const meta = getSeederMetadata(TestSeeder);
    expect(meta).toBeDefined();
    expect(meta!.options.env).toBe("dev");
    expect(meta!.options.order).toBe(1);
  });

  it("should default env to * when not provided", () => {
    @Seeder()
    class DefaultSeeder {}

    const meta = getSeederMetadata(DefaultSeeder);
    expect(meta!.options.env).toBe("*");
  });
});

describe("@Seed decorator", () => {
  it("should register seed properties in metadata", () => {
    @Seeder({ env: "dev" })
    class UserSeeder {
      @Seed(User, { count: 5 })
      users = factory(User, { name: () => "Test" });
    }

    const meta = getSeederMetadata(UserSeeder);
    expect(meta!.seeds).toHaveLength(1);
    expect(meta!.seeds[0].propertyKey).toBe("users");
    expect(meta!.seeds[0].options.count).toBe(5);
  });
});

// ─── Environment Filter ───────────────────────────────────────────────────────

describe("matchesEnvironment()", () => {
  it("should match wildcard *", () => {
    expect(matchesEnvironment("*", "dev")).toBe(true);
    expect(matchesEnvironment("*", "production")).toBe(true);
  });

  it("should match exact env string", () => {
    expect(matchesEnvironment("dev", "dev")).toBe(true);
    expect(matchesEnvironment("dev", "staging")).toBe(false);
  });

  it("should match when env is in array", () => {
    expect(matchesEnvironment(["dev", "staging"], "dev")).toBe(true);
    expect(matchesEnvironment(["dev", "staging"], "production")).toBe(false);
  });

  it("should return true when env is undefined (default to run)", () => {
    expect(matchesEnvironment(undefined, "dev")).toBe(true);
  });
});

// ─── Idempotency ──────────────────────────────────────────────────────────────

describe("computeChecksum()", () => {
  it("should return same checksum for same input", () => {
    const a = computeChecksum("UserSeeder", { count: 10 });
    const b = computeChecksum("UserSeeder", { count: 10 });
    expect(a).toBe(b);
  });

  it("should return different checksum when input changes", () => {
    const a = computeChecksum("UserSeeder", { count: 10 });
    const b = computeChecksum("UserSeeder", { count: 20 });
    expect(a).not.toBe(b);
  });

  it("should return different checksum for different seeder names", () => {
    const a = computeChecksum("UserSeeder", { count: 10 });
    const b = computeChecksum("PostSeeder", { count: 10 });
    expect(a).not.toBe(b);
  });

  it("should return a non-empty hex string", () => {
    const checksum = computeChecksum("TestSeeder", {});
    expect(checksum).toMatch(/^[0-9a-f]+$/);
  });
});
