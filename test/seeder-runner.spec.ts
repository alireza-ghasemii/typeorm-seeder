import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { factory } from "../src/core/factory";
import { SeederRunner } from "../src/core/seeder-runner";
import { Seed, Seeder } from "../src/decorators/seeder.decorator";
import { oneOf, sequence } from "../src/relations";

// ─── Mock DataSource ──────────────────────────────────────────────────────────

class User {
  id!: number;
  name!: string;
  email!: string;
  role!: string;
}

const mockSavedEntities: any[] = [];

const mockRepo = {
  save: jest.fn(async (entities: any[]) => {
    mockSavedEntities.push(...entities);
    return entities;
  }),
  clear: jest.fn(async () => {}),
  findOne: jest.fn(async () => null),
  find: jest.fn(async () => []),
};

const mockDataSource = {
  getRepository: jest.fn(() => mockRepo),
  query: jest.fn(async () => []), // برای idempotency tracker
} as any;

// ─── Seeders ──────────────────────────────────────────────────────────────────

@Seeder({ env: "dev", order: 1 })
class UserSeeder {
  @Seed(User, { count: 3 })
  users = factory(User, {
    name: sequence((i) => `User ${i}`),
    email: sequence((i) => `user${i}@test.com`),
    role: oneOf(["admin", "user"]),
  });
}

@Seeder({ env: "staging" })
class StagingOnlySeeder {
  @Seed(User, { count: 2 })
  users = factory(User, {
    name: () => "Staging User",
    email: () => "staging@test.com",
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("SeederRunner", () => {
  let runner: SeederRunner;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSavedEntities.length = 0;
    runner = new SeederRunner(mockDataSource);
    runner.register([UserSeeder, StagingOnlySeeder]);
  });

  it("should run only seeders matching the env", async () => {
    const results = await runner.run({ env: "dev", silent: true });

    expect(results).toHaveLength(1);
    expect(results[0].seederName).toBe("UserSeeder");
    expect(results[0].skipped).toBe(false);
  });

  it("should run staging seeders when env is staging", async () => {
    const results = await runner.run({ env: "staging", silent: true });

    expect(results).toHaveLength(1);
    expect(results[0].seederName).toBe("StagingOnlySeeder");
  });

  it("should create correct number of entities", async () => {
    await runner.run({ env: "dev", silent: true });

    expect(mockRepo.save).toHaveBeenCalledTimes(1);
    const savedArgs = mockRepo.save.mock.calls[0][0];
    expect(savedArgs).toHaveLength(3); // count: 3
  });

  it("should override count when option is passed", async () => {
    await runner.run({ env: "dev", count: 7, silent: true });

    const savedArgs = mockRepo.save.mock.calls[0][0];
    expect(savedArgs).toHaveLength(7);
  });

  it("should not call repo.save in dry-run mode", async () => {
    const results = await runner.run({
      env: "dev",
      dryRun: true,
      silent: true,
    });

    expect(mockRepo.save).not.toHaveBeenCalled();
    expect(results[0].dryRun).toBe(true);
    expect(results[0].entitiesCreated).toBe(0);
  });

  it("should run only the specified seeder by name", async () => {
    // register یه seeder دیگه هم می‌کنیم
    @Seeder({ env: "dev" })
    class AnotherSeeder {
      @Seed(User, { count: 5 })
      users = factory(User, { name: () => "Another" });
    }
    runner.register([AnotherSeeder]);

    const results = await runner.run({
      env: "dev",
      seeder: "UserSeeder",
      silent: true,
    });

    expect(results).toHaveLength(1);
    expect(results[0].seederName).toBe("UserSeeder");
  });

  it("should skip seeder in idempotent mode if already ran", async () => {
    // شبیه‌سازی حالتی که seeder قبلاً اجرا شده
    mockDataSource.query
      .mockResolvedValueOnce([]) // CREATE TABLE IF NOT EXISTS
      .mockResolvedValueOnce([{ checksum: "abc123" }]); // SELECT checksum — قبلاً اجرا شده

    // checksum باید match کنه — پس باید skip بشه
    // برای این تست، مستقیماً tracker رو mock می‌کنیم
    const { IdempotencyTracker } = await import("../src/core/idempotent");
    const trackerSpy = jest
      .spyOn(IdempotencyTracker.prototype, "hasRun")
      .mockResolvedValue(true);

    const results = await runner.run({
      env: "dev",
      idempotent: true,
      silent: true,
    });

    expect(results[0].skipped).toBe(true);
    expect(mockRepo.save).not.toHaveBeenCalled();

    trackerSpy.mockRestore();
  });

  it("should include duration in results", async () => {
    const results = await runner.run({ env: "dev", silent: true });
    expect(results[0].duration).toBeGreaterThanOrEqual(0);
  });
});
