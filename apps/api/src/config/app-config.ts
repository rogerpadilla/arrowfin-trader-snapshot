import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3001),
    APP_DATABASE_URL: z.url(),
    WEB_ORIGINS: z
      .string()
      .min(1)
      .transform((value) => value.split(',').map((origin) => origin.trim())),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    ENABLE_DEV_TOOLS: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    CLOCK_ANCHOR: z.iso
      .datetime()
      .transform((iso) => new Date(iso))
      .optional()
      .or(z.literal('').transform(() => undefined)),
  })
  .refine((env) => !(env.NODE_ENV === 'production' && env.ENABLE_DEV_TOOLS), {
    message: 'ENABLE_DEV_TOOLS must never be set in production',
    path: ['ENABLE_DEV_TOOLS'],
  });

export type AppConfig = Readonly<{
  production: boolean;
  port: number;
  databaseUrl: string;
  webOrigins: readonly string[];
  jwtSecret: Uint8Array;
  devTools: boolean;
  clockAnchor: Date | undefined;
}>;

/** Fails fast at boot: a misconfigured process never starts serving. */
export const parseAppConfig = (env: NodeJS.ProcessEnv): AppConfig => {
  const parsed = envSchema.parse(env);
  return Object.freeze({
    production: parsed.NODE_ENV === 'production',
    port: parsed.PORT,
    databaseUrl: parsed.APP_DATABASE_URL,
    webOrigins: parsed.WEB_ORIGINS,
    jwtSecret: new TextEncoder().encode(parsed.JWT_SECRET),
    devTools: parsed.ENABLE_DEV_TOOLS,
    clockAnchor: parsed.CLOCK_ANCHOR,
  });
};

export const APP_CONFIG = Symbol('APP_CONFIG');
