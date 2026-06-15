import { Injectable, Inject, OnApplicationBootstrap } from "@nestjs/common";
import { DataSource } from "typeorm";
import { IdempotencyTracker } from "../core/idempotent";
import { SeederRunner } from "../core/seeder-runner";
import { SeederResult, SeederRunOptions } from "../core/types";
import type { SeederModuleOptions } from "./seeder.module";

export const SEEDER_MODULE_OPTIONS = "SEEDER_MODULE_OPTIONS";

@Injectable()
export class SeederService implements OnApplicationBootstrap {
  private runner: SeederRunner;

  constructor(
    private readonly dataSource: DataSource,
    @Inject(SEEDER_MODULE_OPTIONS)
    private readonly options: SeederModuleOptions,
  ) {
    this.runner = new SeederRunner(dataSource);

    if (options.seeders?.length) {
      this.runner.register(options.seeders);
    }
  }

  /**
   * اگر runOnInit: true باشه، بعد از bootstrap اپ خودکار اجرا می‌شه
   */
  async onApplicationBootstrap(): Promise<void> {
    if (!this.options.runOnInit) return;

    await this.run({
      env: this.options.env,
      idempotent: this.options.idempotent ?? true, // پیش‌فرض idempotent در NestJS
      silent: this.options.silent ?? false,
    });
  }

  /**
   * اجرای همه seeder ها (یا یه seeder خاص)
   *
   * @example
   * // در یه NestJS command یا controller
   * await this.seederService.run({ env: 'dev' })
   * await this.seederService.run({ seeder: 'UserSeeder', count: 50 })
   */
  async run(options: Partial<SeederRunOptions> = {}): Promise<SeederResult[]> {
    return this.runner.run({
      env: this.options.env ?? "dev",
      idempotent: this.options.idempotent ?? false,
      ...options,
    });
  }

  /**
   * فقط یه seeder خاص رو اجرا می‌کنه
   */
  async runOne(
    seederName: string,
    options: Partial<SeederRunOptions> = {},
  ): Promise<SeederResult> {
    const results = await this.run({ ...options, seeder: seederName });
    const result = results.find((r) => r.seederName === seederName);
    if (!result)
      throw new Error(
        `[typeorm-seeder] Seeder "${seederName}" not found or did not run`,
      );
    return result;
  }

  /**
   * لیست تاریخچه seeder های اجرا شده
   */
  async getHistory() {
    const tracker = new IdempotencyTracker(this.dataSource);
    return tracker.getHistory();
  }

  /**
   * reset کردن تاریخچه (برای اجرای مجدد)
   */
  async resetHistory(seederName?: string, env?: string): Promise<void> {
    const tracker = new IdempotencyTracker(this.dataSource);
    await tracker.reset(seederName, env);
  }
}
