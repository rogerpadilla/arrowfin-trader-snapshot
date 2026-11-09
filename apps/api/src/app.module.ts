import { type DynamicModule, Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { APP_CONFIG, type AppConfig } from './config/app-config.js';
import { DevModule } from './dev/dev.module.js';
import { SnapshotModule } from './snapshot/snapshot.module.js';
import { TenancyModule } from './tenancy/tenancy.module.js';

@Module({})
export class AppModule {
  /** Dev routes are not imported at all unless enabled, and parseAppConfig refuses to enable them in production. */
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      global: true,
      imports: [TenancyModule, AuthModule, SnapshotModule, ...(config.devTools ? [DevModule] : [])],
      providers: [{ provide: APP_CONFIG, useValue: config }],
      exports: [APP_CONFIG],
    };
  }
}
