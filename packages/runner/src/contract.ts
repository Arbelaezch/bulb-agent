// The only runner file that imports the contract.
// Relative import because the npm scope is unconfirmed (see the repo's agent instructions file); switch to the
// package name once confirmed.
// The same relative path resolves from src/ and from dist/.
export {
  BulbConfigError,
  ContractValidationError,
  parseBulbConfig,
  parseOutcome,
  parseTaskState,
  parseWakeEvent,
  readBulbConfigFile,
} from '../../contract/dist/index.js';
export type {
  BulbConfig,
  Outcome,
  TaskState,
  ValidationIssue,
  WakeEvent,
} from '../../contract/dist/index.js';
