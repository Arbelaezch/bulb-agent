// Validators for the dashboard API's own documents: the auth header, the write ack and the error body.
// Request bodies reuse the existing contract documents (task state, outcome, lifecycle notification).
import dashboardRequestHeadersSchema from '../schemas/dashboard-request-headers.schema.json' with { type: 'json' };
import dashboardAckSchema from '../schemas/dashboard-ack.schema.json' with { type: 'json' };
import dashboardErrorSchema from '../schemas/dashboard-error.schema.json' with { type: 'json' };
import type { DashboardRequestHeaders } from '../generated/dashboard-request-headers.js';
import type { DashboardAck } from '../generated/dashboard-ack.js';
import type { DashboardError } from '../generated/dashboard-error.js';
import type { ValidationIssue } from './issues.js';
import { createParser } from './validate.js';

export { dashboardRequestHeadersSchema, dashboardAckSchema, dashboardErrorSchema };

/**
 * Validates dashboard request headers (lower-case names) and returns a clone; throws `ContractValidationError`.
 * Issues name the schema pattern, never the header value, so the bearer token is not leaked.
 */
export const parseDashboardRequestHeaders = createParser<DashboardRequestHeaders>(
  dashboardRequestHeadersSchema,
  'dashboard request headers',
);

/** Validates a dashboard write ack and returns a clone; throws `ContractValidationError`. */
export const parseDashboardAck = createParser<DashboardAck>(dashboardAckSchema, 'dashboard ack');

/** Most issues a `DashboardError` body may carry (`issues.maxItems`). */
export const DASHBOARD_ERROR_MAX_ISSUES = 50;
/** Longest issue `path` or `message` a `DashboardError` body may carry, in code points (`maxLength`). */
export const DASHBOARD_ERROR_ISSUE_MAX_LENGTH = 500;

function truncate(value: string): string {
  const chars = Array.from(value);
  if (chars.length <= DASHBOARD_ERROR_ISSUE_MAX_LENGTH) return value;
  return `${chars.slice(0, DASHBOARD_ERROR_ISSUE_MAX_LENGTH - 3).join('')}...`;
}

/**
 * Fits contract parser issues into a `DashboardError` body: keeps the first 50 and truncates each `path` and
 * `message` to 500 code points (ending in `...`). Paths can hold client-supplied key names of any length, so a
 * dashboard must pass issues through this before sending them.
 */
export function toDashboardErrorIssues(issues: readonly ValidationIssue[]): ValidationIssue[] {
  return issues.slice(0, DASHBOARD_ERROR_MAX_ISSUES).map((issue) => ({
    path: truncate(issue.path),
    message: issue.message === '' ? 'is invalid' : truncate(issue.message),
  }));
}

/** Validates a dashboard error body and returns a clone; throws `ContractValidationError`. */
export const parseDashboardError = createParser<DashboardError>(
  dashboardErrorSchema,
  'dashboard error',
);
