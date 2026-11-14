// Config types are generated from src/schemas/bulb-config.schema.json (`npm run generate`), never hand-written.
export type { BulbConfig, BulbConfigInput } from './generated/bulb-config.js';
export {
  BulbConfigError,
  bulbConfigSchema,
  loadBulbConfig,
  parseBulbConfig,
  readBulbConfigFile,
} from './config/load.js';
export type { BulbConfigIssue } from './config/load.js';
export { parseDurationMs } from './config/duration.js';
