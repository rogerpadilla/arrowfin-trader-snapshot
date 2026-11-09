import { TEST_SECRET_TEXT } from '../auth/test-fixtures.js';
import { parseAppConfig } from './app-config.js';

const baseEnv = {
  APP_DATABASE_URL: 'postgresql://arrowfin_app:x@localhost:55432/arrowfin',
  WEB_ORIGINS: 'http://localhost:3000',
  JWT_SECRET: TEST_SECRET_TEXT,
};

describe('parseAppConfig', () => {
  it('refuses to boot production with dev tools enabled', () => {
    expect(() =>
      parseAppConfig({ ...baseEnv, NODE_ENV: 'production', ENABLE_DEV_TOOLS: 'true' }),
    ).toThrow(/ENABLE_DEV_TOOLS/);
  });

  it('keeps dev tools off unless explicitly enabled', () => {
    expect(parseAppConfig({ ...baseEnv, NODE_ENV: 'development' }).devTools).toBe(false);
  });

  it('refuses a short signing secret', () => {
    expect(() => parseAppConfig({ ...baseEnv, JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
  });
});
