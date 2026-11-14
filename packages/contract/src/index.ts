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
export { ContractValidationError } from './validation/validate.js';
export type { ValidationIssue } from './validation/issues.js';
export type { WakeEvent } from './generated/wake-event.js';
export type { Outcome } from './generated/outcome.js';
export type { LifecycleNotification } from './generated/lifecycle-notification.js';
export {
  lifecycleNotificationSchema,
  outcomeSchema,
  parseLifecycleNotification,
  parseOutcome,
  parseWakeEvent,
  wakeEventSchema,
} from './validation/documents.js';
export type { TaskState } from './generated/task-state.js';
export type { ResponsibilityScope } from './generated/responsibility-scope.js';
export {
  parseResponsibilityScope,
  parseTaskState,
  responsibilityScopeSchema,
  taskStateSchema,
} from './validation/task-documents.js';
export {
  TASK_STATE_MAX_BYTES,
  assertTaskStateSize,
  taskStateByteLength,
} from './validation/task-state-size.js';
export { parseDurationMs } from './config/duration.js';
export type { DashboardRequestHeaders } from './generated/dashboard-request-headers.js';
export type { DashboardAck } from './generated/dashboard-ack.js';
export type { DashboardError } from './generated/dashboard-error.js';
export {
  DASHBOARD_ERROR_ISSUE_MAX_LENGTH,
  DASHBOARD_ERROR_MAX_ISSUES,
  dashboardAckSchema,
  dashboardErrorSchema,
  dashboardRequestHeadersSchema,
  parseDashboardAck,
  parseDashboardError,
  parseDashboardRequestHeaders,
  toDashboardErrorIssues,
} from './validation/dashboard-api.js';
export {
  DASHBOARD_API_VERSION,
  DASHBOARD_AUTH_HEADER,
  DASHBOARD_AUTH_SCHEME,
  DASHBOARD_ERROR_STATUS,
  dashboardApiEndpoints,
  dashboardApiPath,
  matchDashboardApiRoute,
} from './dashboard-api/endpoints.js';
export type {
  DashboardEndpoint,
  DashboardEndpointId,
  DashboardRouteMatch,
  DashboardRouteParams,
} from './dashboard-api/endpoints.js';
