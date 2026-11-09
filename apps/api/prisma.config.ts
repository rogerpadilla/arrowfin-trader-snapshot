import { defineConfig, env } from 'prisma/config';
import { loadDotEnv } from './src/config/dotenv.js';

loadDotEnv();

// The CLI (migrate, seed) runs as the schema owner. The application connects as arrowfin_app instead, see src/config/app-config.ts.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('OWNER_DATABASE_URL'),
  },
});
