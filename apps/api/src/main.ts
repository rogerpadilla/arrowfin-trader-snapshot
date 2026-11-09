import { createApp } from './bootstrap.js';
import { parseAppConfig } from './config/app-config.js';
import { loadDotEnv } from './config/dotenv.js';

loadDotEnv();
const config = parseAppConfig(process.env);
const app = await createApp(config);
await app.listen(config.port);
