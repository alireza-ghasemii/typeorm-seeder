#!/usr/bin/env node
import { Command } from "commander";
import { globSync } from "glob";
import { pathToFileURL } from "url";
import { getSeederMetadata } from "../decorators/seeder.decorator";
import { matchesEnvironment } from "../environments/env-filter";
import { IdempotencyTracker } from "../core/idempotent";
import { SeederRunner } from "../core/seeder-runner";

const program = new Command();

program.name("seed").description("typeorm-seeder CLI").version("0.1.0");

program
  .command("run")
  .description("Run seeders")
  .option("--seeder <name>", "Name of seeder class to run")
  .option("--env <env>", "Target environment", process.env.SEEDER_ENV ?? "dev")
  .option("--count <number>", "Override entity count", parseInt)
  .option("--dry-run", "Preview without DB writes", false)
  .option("--silent", "Suppress output", false)
  .option("--idempotent", "Skip seeders that already ran", false)
  .option("--data-source <path>", "Path to a TypeORM data source module", "src/data-source")
  .option("--seeders <path>", "Glob pattern for seeder files", "src/seeders/**/*.seeder.{ts,js}")
  .action(async (options) => {
    try {
      const AppDataSource = await loadDataSource(options.dataSource);

      const runner = new SeederRunner(AppDataSource);

      runner.register(await loadSeederClasses(options.seeders));

      const results = await runner.run({
        env: options.env,
        seeder: options.seeder,
        count: options.count,
        dryRun: options.dryRun,
        silent: options.silent,
        idempotent: options.idempotent,
      });

      const total = results.reduce((sum, r) => sum + r.entitiesCreated, 0);
      console.log(
        `\n✨ Done! ${total} records created across ${results.length} seeders.`,
      );

      process.exit(0);
    } catch (err) {
      console.error("\n❌ Seeder failed:", err);
      process.exit(1);
    }
  });

program
  .command("list")
  .description("List all registered seeders")
  .option("--env <env>", "Target environment", process.env.SEEDER_ENV ?? "dev")
  .option("--seeders <path>", "Glob pattern for seeder files", "src/seeders/**/*.seeder.{ts,js}")
  .action(async (options) => {
    const seederClasses = await loadSeederClasses(options.seeders);
    const rows = seederClasses
      .map((seederClass) => getSeederMetadata(seederClass))
      .filter((meta): meta is NonNullable<typeof meta> => !!meta)
      .map((meta) => ({
        name: meta.options.name ?? meta.target.name,
        env: Array.isArray(meta.options.env)
          ? meta.options.env.join(",")
          : (meta.options.env ?? "*"),
        order: meta.options.order ?? 0,
        matches: matchesEnvironment(meta.options.env, options.env),
      }));

    console.log("📋 Registered seeders:");
    for (const row of rows) {
      console.log(
        `  ${row.matches ? "✓" : "-"} ${row.name} (env: ${row.env}, order: ${row.order})`,
      );
    }
  });

program
  .command("reset")
  .description("Reset seeder history (dev/test only)")
  .option("--seeder <name>", "Name of seeder history entry to reset")
  .option("--env <env>", "Target environment", process.env.SEEDER_ENV ?? "dev")
  .option("--data-source <path>", "Path to a TypeORM data source module", "src/data-source")
  .action(async (options) => {
    if (!["dev", "test"].includes(options.env)) {
      throw new Error(
        `[typeorm-seeder] reset is only allowed for dev/test environments`,
      );
    }

    const AppDataSource = await loadDataSource(options.dataSource);
    const tracker = new IdempotencyTracker(AppDataSource);
    await tracker.reset(options.seeder, options.env);
    console.log("🗑️  Seeder history reset.");
  });

program.parse(process.argv);

async function importModuleFromCwd(path: string): Promise<Record<string, any>> {
  const absolutePath = path.startsWith("/")
    ? path
    : `${process.cwd()}/${path}`;

  return import(pathToFileURL(absolutePath).href);
}

async function loadDataSource(path: string): Promise<any> {
  const dataSourceModule = await importModuleFromCwd(path);
  const AppDataSource = dataSourceModule.AppDataSource ?? dataSourceModule.default;

  if (!AppDataSource) {
    throw new Error(
      `[typeorm-seeder] Data source module must export AppDataSource or default`,
    );
  }

  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  return AppDataSource;
}

async function loadSeederClasses(pattern: string): Promise<Function[]> {
  const files = globSync(pattern, {
    absolute: true,
    cwd: process.cwd(),
  });

  const seeders: Function[] = [];

  for (const file of files) {
    const mod = await import(pathToFileURL(file).href);
    const seederClasses = Object.values(mod).filter(
      (v) => typeof v === "function",
    );
    seeders.push(...(seederClasses as Function[]));
  }

  return seeders;
}
