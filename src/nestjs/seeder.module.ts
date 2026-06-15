import { DynamicModule, Module, ModuleMetadata, Type } from "@nestjs/common";
import { SEEDER_MODULE_OPTIONS, SeederService } from "./seeder.service";
import { SeederEnvironment } from "../core/types";

// ─── Options ──────────────────────────────────────────────────────────────────

export interface SeederModuleOptions {
  /** لیست seeder class هایی که باید register بشن */
  seeders?: Function[];

  /** محیط پیش‌فرض اجرا */
  env?: string;

  /**
   * آیا بعد از bootstrap اپ، seeder ها خودکار اجرا بشن؟
   * @default false
   */
  runOnInit?: boolean;

  /**
   * آیا seeder هایی که قبلاً اجرا شدن skip بشن؟
   * @default true (وقتی از NestJS module استفاده می‌کنی)
   */
  idempotent?: boolean;

  /** suppress کردن log ها */
  silent?: boolean;
}

export interface SeederModuleAsyncOptions extends Pick<
  ModuleMetadata,
  "imports"
> {
  useFactory: (
    ...args: any[]
  ) => Promise<SeederModuleOptions> | SeederModuleOptions;
  inject?: any[];
}

// ─── Module ───────────────────────────────────────────────────────────────────

@Module({})
export class SeederModule {
  /**
   * استفاده مستقیم با options ثابت
   *
   * @example
   * SeederModule.forRoot({
   *   seeders: [UserSeeder, PostSeeder],
   *   env: 'dev',
   *   runOnInit: true,
   *   idempotent: true,
   * })
   */
  static forRoot(options: SeederModuleOptions): DynamicModule {
    return {
      module: SeederModule,
      global: true,
      providers: [
        {
          provide: SEEDER_MODULE_OPTIONS,
          useValue: options,
        },
        SeederService,
      ],
      exports: [SeederService],
    };
  }

  /**
   * استفاده async — مثلاً وقتی config از ConfigService میاد
   *
   * @example
   * SeederModule.forRootAsync({
   *   imports: [ConfigModule],
   *   inject: [ConfigService],
   *   useFactory: (config: ConfigService) => ({
   *     seeders: [UserSeeder],
   *     env: config.get('NODE_ENV'),
   *     idempotent: true,
   *   }),
   * })
   */
  static forRootAsync(options: SeederModuleAsyncOptions): DynamicModule {
    return {
      module: SeederModule,
      global: true,
      imports: options.imports ?? [],
      providers: [
        {
          provide: SEEDER_MODULE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
        SeederService,
      ],
      exports: [SeederService],
    };
  }
}
