// The dashboard API endpoint table: method, path template, request and success response of each endpoint.
// Pure data and helpers with no Node built-ins, so both the mock server and HTTP adapters can share it.
import type { DashboardError } from '../generated/dashboard-error.js';

export const DASHBOARD_API_VERSION = 'v1';

/** Request header carrying the credential; lower-case, as Node delivers header names. */
export const DASHBOARD_AUTH_HEADER = 'authorization';

/** Case-sensitive auth scheme: the header value is `Bearer <token>`. The token is a secret. */
export const DASHBOARD_AUTH_SCHEME = 'Bearer';

/** HTTP status sent with each `DashboardError` code. */
export const DASHBOARD_ERROR_STATUS: Readonly<Record<DashboardError['error'], number>> =
  Object.freeze({
    invalid_request: 400,
    unauthorized: 401,
    not_found: 404,
    method_not_allowed: 405,
    payload_too_large: 413,
    internal: 500,
  });

export type DashboardEndpointId =
  'save_task_state' | 'load_task_state' | 'post_outcome' | 'post_notification';

/** One dashboard API endpoint. Every endpoint returns status 200 on success. */
export interface DashboardEndpoint {
  id: DashboardEndpointId;
  method: 'GET' | 'PUT' | 'POST';
  /** Path template, e.g. `/v1/repos/{owner}/{name}/tasks/{task_id}/state`. */
  path: string;
  /** Contract document sent as the JSON body, or `null` when the request has no body. */
  request: 'TaskState' | 'Outcome' | 'LifecycleNotification' | null;
  /** Contract document returned with status 200. */
  response: 'DashboardAck' | 'TaskState';
}

export interface DashboardRouteParams {
  /** `owner/name`. */
  repo: string;
  task_id?: string;
}

export type DashboardRouteMatch =
  | { kind: 'match'; endpoint: DashboardEndpoint; params: DashboardRouteParams }
  | { kind: 'not_found' }
  | { kind: 'method_not_allowed'; allow: readonly string[] };

const STATE_PATH = `/${DASHBOARD_API_VERSION}/repos/{owner}/{name}/tasks/{task_id}/state`;

export const dashboardApiEndpoints: readonly DashboardEndpoint[] = Object.freeze(
  (
    [
      {
        id: 'save_task_state',
        method: 'PUT',
        path: STATE_PATH,
        request: 'TaskState',
        response: 'DashboardAck',
      },
      {
        id: 'load_task_state',
        method: 'GET',
        path: STATE_PATH,
        request: null,
        response: 'TaskState',
      },
      {
        id: 'post_outcome',
        method: 'POST',
        path: `/${DASHBOARD_API_VERSION}/repos/{owner}/{name}/outcomes`,
        request: 'Outcome',
        response: 'DashboardAck',
      },
      {
        id: 'post_notification',
        method: 'POST',
        path: `/${DASHBOARD_API_VERSION}/repos/{owner}/{name}/notifications`,
        request: 'LifecycleNotification',
        response: 'DashboardAck',
      },
    ] satisfies DashboardEndpoint[]
  ).map((endpoint) => Object.freeze(endpoint)),
);

// Same rules as the `repo` and `task_id` patterns in the contract schemas.
const REPO_PART_PATTERN = /^[A-Za-z0-9_.-]+$/;
const TASK_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const TASK_ID_MAX_LENGTH = 128;

function isRepoPart(value: string): boolean {
  return REPO_PART_PATTERN.test(value) && value !== '.' && value !== '..';
}

function isTaskId(value: string): boolean {
  return value.length <= TASK_ID_MAX_LENGTH && TASK_ID_PATTERN.test(value);
}

/**
 * Builds the concrete path for an endpoint, URL-encoding each segment. Throws `RangeError` for an unknown
 * endpoint, a `repo` that is not `owner/name`, or a missing or invalid `task_id` on the task-state endpoints.
 * Error messages never include the rejected value.
 */
export function dashboardApiPath(
  id: DashboardEndpointId,
  params: { repo: string; task_id?: string },
): string {
  const endpoint = dashboardApiEndpoints.find((e) => e.id === id);
  if (endpoint === undefined) {
    throw new RangeError('unknown dashboard API endpoint');
  }
  const parts = typeof params.repo === 'string' ? params.repo.split('/') : [];
  const [owner, name] = parts;
  if (parts.length !== 2 || owner === undefined || name === undefined) {
    throw new RangeError('repo must be owner/name');
  }
  if (!isRepoPart(owner) || !isRepoPart(name)) {
    throw new RangeError('repo must be owner/name');
  }
  const values: Record<string, string> = { owner, name };
  if (endpoint.path.includes('{task_id}')) {
    if (typeof params.task_id !== 'string' || !isTaskId(params.task_id)) {
      throw new RangeError('task_id is missing or invalid');
    }
    values.task_id = params.task_id;
  }
  return endpoint.path.replace(/\{([a-z_]+)\}/g, (_match, key: string) =>
    encodeURIComponent(values[key] ?? ''),
  );
}

/** Matches one template against decoded path segments; returns the params or `undefined`. */
function matchTemplate(
  template: string,
  segments: readonly string[],
): DashboardRouteParams | undefined {
  const templateSegments = template.split('/');
  if (templateSegments.length !== segments.length) {
    return undefined;
  }
  const values: Record<string, string> = {};
  for (const [index, expected] of templateSegments.entries()) {
    const actual = segments[index] as string;
    const param = /^\{([a-z_]+)\}$/.exec(expected)?.[1];
    if (param === undefined) {
      if (actual !== expected) return undefined;
      continue;
    }
    const valid = param === 'task_id' ? isTaskId(actual) : isRepoPart(actual);
    if (!valid) return undefined;
    values[param] = actual;
  }
  const params: DashboardRouteParams = { repo: `${values.owner}/${values.name}` };
  if (values.task_id !== undefined) {
    params.task_id = values.task_id;
  }
  return params;
}

/**
 * Routes a request. `pathname` is the URL path without query string; each segment is URL-decoded and a
 * segment that fails to decode, or an owner, name or task id that breaks the contract patterns, gives
 * `not_found`. A path that matches but with another method gives `method_not_allowed` and the allowed methods.
 */
export function matchDashboardApiRoute(method: string, pathname: string): DashboardRouteMatch {
  let segments: string[];
  try {
    segments = pathname.split('/').map((segment) => decodeURIComponent(segment));
  } catch {
    return { kind: 'not_found' };
  }

  const allow: string[] = [];
  for (const endpoint of dashboardApiEndpoints) {
    const params = matchTemplate(endpoint.path, segments);
    if (params === undefined) continue;
    if (endpoint.method === method) {
      return { kind: 'match', endpoint, params };
    }
    allow.push(endpoint.method);
  }
  return allow.length > 0
    ? { kind: 'method_not_allowed', allow: allow.sort() }
    : { kind: 'not_found' };
}
