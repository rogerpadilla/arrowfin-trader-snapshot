import { existsSync } from 'node:fs';

export const loadDotEnv = (): void => {
  if (existsSync('.env')) process.loadEnvFile('.env');
};
