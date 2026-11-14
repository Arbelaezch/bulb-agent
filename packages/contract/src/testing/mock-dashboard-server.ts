// Local mock of the dashboard API for tests of the dashboard adapters. Tests only: never import this from the
// package's main entry, because it pulls in `node:http`.
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  ContractValidationError,
  DASHBOARD_AUTH_SCHEME,
  DASHBOARD_ERROR_STATUS,
  TASK_STATE_MAX_BYTES,
  matchDashboardApiRoute,
  parseDashboardAck,
  parseDashboardError,
  parseDashboardRequestHeaders,
  parseLifecycleNotification,
  parseOutcome,
  parseTaskState,
  taskStateByteLength,
  toDashboardErrorIssues,
} from '../index.js';
import type {
  DashboardEndpoint,
  DashboardEndpointId,
  DashboardError,
  LifecycleNotification,
  Outcome,
  TaskState,
  ValidationIssue,
} from '../index.js';

export const MOCK_MAX_BODY_BYTES = 1_048_576;

const TOKEN_PATTERN = /^[A-Za-z0-9._~+/-]+=*$/;
const SEPARATOR = '\u0000';

/** A request the mock served. Never holds headers or bodies, so the token cannot leak through it. */
export interface MockDashboardRequest {
  method: string;
  path: string;
  endpoint: DashboardEndpointId | null;
  status: number;
}

export interface MockDashboardServer {
  readonly url: string;
  readonly requests: readonly MockDashboardRequest[];
  taskState(repo: string, taskId: string): TaskState | undefined;
  outcomes(): readonly Outcome[];
  notifications(): readonly LifecycleNotification[];
  seedTaskState(repo: string, state: TaskState): void;
  reset(): void;
  close(): Promise<void>;
}

class HttpError extends Error {
  readonly code: DashboardError['error'];
  readonly issues: readonly ValidationIssue[] | undefined;

  constructor(code: DashboardError['error'], message: string, issues?: readonly ValidationIssue[]) {
    super(message);
    this.code = code;
    this.issues = issues;
  }
}

class BodyTooLargeError extends Error {}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let tooLarge = false;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MOCK_MAX_BODY_BYTES) {
        tooLarge = true;
        chunks.length = 0;
        return;
      }
      if (!tooLarge) chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooLarge) reject(new BodyTooLargeError());
      else resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', reject);
  });
}

function parseBody(
  endpoint: DashboardEndpoint,
  raw: string,
): TaskState | Outcome | LifecycleNotification {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new HttpError('invalid_request', 'body is not valid JSON');
  }
  try {
    switch (endpoint.request) {
      case 'TaskState':
        return parseTaskState(json);
      case 'Outcome':
        return parseOutcome(json);
      default:
        return parseLifecycleNotification(json);
    }
  } catch (err) {
    if (err instanceof ContractValidationError) {
      throw new HttpError(
        'invalid_request',
        `invalid ${err.document}`,
        toDashboardErrorIssues(err.issues),
      );
    }
    throw err;
  }
}

/**
 * Starts a local mock of the dashboard API on `host:port` (default `127.0.0.1`, any free port). Requests need
 * `Authorization: Bearer <token>`. Throws `TypeError` when `token` is empty or has characters outside RFC 6750.
 */
export async function startMockDashboardServer(options: {
  token: string;
  host?: string;
  port?: number;
}): Promise<MockDashboardServer> {
  const { token } = options;
  if (typeof token !== 'string' || token === '' || !TOKEN_PATTERN.test(token)) {
    throw new TypeError('token must be a non-empty bearer token');
  }
  const host = options.host ?? '127.0.0.1';

  const states = new Map<string, TaskState>();
  const outcomes = new Map<string, Outcome>();
  const notifications = new Map<string, LifecycleNotification>();
  const requests: MockDashboardRequest[] = [];

  function respond(
    res: ServerResponse,
    record: { method: string; path: string; endpoint: DashboardEndpointId | null },
    status: number,
    body: unknown,
    extraHeaders: Record<string, string> = {},
  ): void {
    // The mock must never send a body that breaks its own schema.
    const checked =
      status >= 400
        ? parseDashboardError(body)
        : body !== null && typeof body === 'object' && 'ok' in body
          ? parseDashboardAck(body)
          : parseTaskState(body);
    requests.push({ ...record, status });
    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      ...extraHeaders,
    });
    res.end(JSON.stringify(checked));
  }

  function errorBody(
    code: DashboardError['error'],
    message: string,
    issues?: readonly ValidationIssue[],
  ) {
    return issues === undefined ? { error: code, message } : { error: code, message, issues };
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const record: { method: string; path: string; endpoint: DashboardEndpointId | null } = {
      method: req.method ?? '',
      path: '',
      endpoint: null,
    };
    try {
      const pathname = new URL(req.url ?? '/', 'http://x').pathname;
      record.path = pathname;
      const route = matchDashboardApiRoute(record.method, pathname);
      if (route.kind === 'not_found') {
        respond(res, record, DASHBOARD_ERROR_STATUS.not_found, errorBody('not_found', 'not found'));
        return;
      }
      if (route.kind === 'method_not_allowed') {
        respond(
          res,
          record,
          DASHBOARD_ERROR_STATUS.method_not_allowed,
          errorBody('method_not_allowed', 'method not allowed'),
          { allow: route.allow.join(', ') },
        );
        return;
      }
      const { endpoint, params } = route;
      record.endpoint = endpoint.id;

      let authorized = false;
      try {
        const { authorization } = parseDashboardRequestHeaders(req.headers);
        authorized = authorization === `${DASHBOARD_AUTH_SCHEME} ${token}`;
      } catch (err) {
        if (!(err instanceof ContractValidationError)) throw err;
      }
      if (!authorized) {
        throw new HttpError('unauthorized', 'missing or invalid bearer token');
      }

      if (endpoint.request === null) {
        if (endpoint.id === 'load_task_state') {
          const state = states.get(`${params.repo}${SEPARATOR}${params.task_id}`);
          if (state === undefined) throw new HttpError('not_found', 'no task state saved');
          respond(res, record, 200, structuredClone(state));
          return;
        }
        throw new Error('unhandled endpoint');
      }

      let raw: string;
      try {
        raw = await readBody(req);
      } catch (err) {
        if (err instanceof BodyTooLargeError) {
          throw new HttpError('payload_too_large', 'request body is too large');
        }
        throw err;
      }
      const body = parseBody(endpoint, raw);

      if (endpoint.id === 'save_task_state') {
        const state = body as TaskState;
        if (state.task_id !== params.task_id) {
          throw new HttpError('invalid_request', 'invalid task state', [
            { path: 'task_id', message: 'must match the task id in the URL' },
          ]);
        }
        // Guards future state versions: a schema-valid v1 state cannot reach the limit today.
        if (taskStateByteLength(state) > TASK_STATE_MAX_BYTES) {
          throw new HttpError('payload_too_large', 'task state is too large');
        }
        states.set(`${params.repo}${SEPARATOR}${state.task_id}`, state);
      } else {
        const doc = body as Outcome | LifecycleNotification;
        if (doc.repo !== params.repo) {
          throw new HttpError(
            'invalid_request',
            `invalid ${endpoint.request === 'Outcome' ? 'outcome' : 'lifecycle notification'}`,
            [{ path: 'repo', message: 'must match the repository in the URL' }],
          );
        }
        if (endpoint.id === 'post_outcome') {
          outcomes.set(`${doc.repo}${SEPARATOR}${doc.task_id}`, doc as Outcome);
        } else {
          const n = doc as LifecycleNotification;
          notifications.set(`${n.repo}${SEPARATOR}${n.task_id}${SEPARATOR}${n.notification}`, n);
        }
      }
      respond(res, record, 200, { ok: true });
    } catch (err) {
      const failure = err instanceof HttpError ? err : new HttpError('internal', 'internal error');
      try {
        respond(
          res,
          record,
          DASHBOARD_ERROR_STATUS[failure.code],
          errorBody(failure.code, failure.message, failure.issues),
        );
      } catch {
        // The error body broke its own schema; fall back to a fixed, known-valid one.
        respond(
          res,
          record,
          DASHBOARD_ERROR_STATUS.internal,
          errorBody('internal', 'internal error'),
        );
      }
    }
  }

  const server = createServer((req, res) => {
    handle(req, res).catch(() => {
      // respond() itself failed; nothing safe left to send.
      res.destroy();
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port ?? 0, host, () => {
      server.off('error', reject);
      resolve();
    });
  });
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://${host.includes(':') ? `[${host}]` : host}:${port}`,
    get requests() {
      return requests.map((r) => ({ ...r }));
    },
    taskState(repo, taskId) {
      const state = states.get(`${repo}${SEPARATOR}${taskId}`);
      return state === undefined ? undefined : structuredClone(state);
    },
    outcomes: () => structuredClone([...outcomes.values()]),
    notifications: () => structuredClone([...notifications.values()]),
    seedTaskState(repo, state) {
      const valid = parseTaskState(state);
      states.set(`${repo}${SEPARATOR}${valid.task_id}`, valid);
    },
    reset() {
      states.clear();
      outcomes.clear();
      notifications.clear();
      requests.length = 0;
    },
    close() {
      return new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
        server.closeAllConnections();
      });
    },
  };
}
