import { ConsoleLogger, type INestApplication, StandardSchemaValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';
import { AppModule } from './app.module.js';
import type { AppConfig } from './config/app-config.js';

/** Browsers do not apply CORS to WebSocket upgrades, so the Origin allowlist is checked here (cross-site WebSocket hijacking). */
class OriginCheckedIoAdapter extends IoAdapter {
  constructor(
    app: INestApplication,
    private readonly allowedOrigins: readonly string[],
  ) {
    super(app);
  }

  override createIOServer(port: number, options?: ServerOptions) {
    if (!options) throw new Error('Socket.IO server options are required');
    return super.createIOServer(port, {
      ...options,
      allowRequest: (request, callback) =>
        callback(null, this.allowedOrigins.includes(request.headers.origin ?? '')),
    });
  }
}

export const createApp = async (config: AppConfig): Promise<NestExpressApplication> => {
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(config), {
    logger: new ConsoleLogger({ json: true }),
  });
  app.disable('x-powered-by');
  app.useGlobalPipes(new StandardSchemaValidationPipe());
  app.useWebSocketAdapter(new OriginCheckedIoAdapter(app, config.webOrigins));
  app.enableShutdownHooks();
  return app;
};
