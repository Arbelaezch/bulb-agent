import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  ContractValidationError,
  DASHBOARD_ERROR_ISSUE_MAX_LENGTH,
  DASHBOARD_ERROR_MAX_ISSUES,
  DASHBOARD_ERROR_STATUS,
  dashboardApiEndpoints,
  dashboardApiPath,
  dashboardErrorSchema,
  dashboardRequestHeadersSchema,
  matchDashboardApiRoute,
  parseDashboardAck,
  parseDashboardError,
  parseDashboardRequestHeaders,
  toDashboardErrorIssues,
} from '../src/index.js';
import type {
  DashboardAck,
  DashboardError,
  DashboardRequestHeaders,
  ValidationIssue,
} from '../src/index.js';

type Doc = Record<string, unknown>;

function mutated(base: Doc, mutate: (doc: Doc) => void): Doc {
  const doc = structuredClone(base);
  mutate(doc);
  return doc;
}

function errorOf(parse: (value: unknown) => unknown, value: unknown): ContractValidationError {
  try {
    parse(value);
  } catch (err) {
    expect(err).toBeInstanceOf(ContractValidationError);
    return err as ContractValidationError;
  }
  throw new Error('expected the parser to throw');
}

function issuesOf(
  parse: (value: unknown) => unknown,
  document: string,
  value: unknown,
): readonly ValidationIssue[] {
  const err = errorOf(parse, value);
  expect(err.document).toBe(document);
  return err.issues;
}

const authPattern = dashboardRequestHeadersSchema.properties.authorization.pattern;

describe('parseDashboardRequestHeaders', () => {
  const headers: Doc = {
    authorization: 'Bearer abc.DEF-123_~+/=',
    'content-type': 'application/json',
  };

  it('accepts a bearer token and other headers', () => {
    expect(parseDashboardRequestHeaders(headers)).toEqual(headers);
  });

  it('rejects a missing authorization header', () => {
    const doc = mutated(headers, (d) => delete d.authorization);
    expect(issuesOf(parseDashboardRequestHeaders, 'dashboard request headers', doc)).toEqual([
      { path: 'authorization', message: 'is required' },
    ]);
  });

  it.each(['Basic abc', 'bearer abc', 'Bearer '])('rejects authorization %j', (value) => {
    const doc = mutated(headers, (d) => (d.authorization = value));
    expect(issuesOf(parseDashboardRequestHeaders, 'dashboard request headers', doc)).toEqual([
      { path: 'authorization', message: `must match pattern "${authPattern}"` },
    ]);
  });

  it('never includes the rejected token in the error', () => {
    const err = errorOf(parseDashboardRequestHeaders, { authorization: 'Basic s3cr3t-value' });
    expect(JSON.stringify(err.issues)).not.toContain('s3cr3t-value');
    expect(err.message).not.toContain('s3cr3t-value');
  });
});

describe('parseDashboardAck', () => {
  it('accepts { ok: true }', () => {
    expect(parseDashboardAck({ ok: true })).toEqual({ ok: true });
  });

  it.each<[string, unknown, ValidationIssue]>([
    [
      'ok: false',
      { ok: false },
      { path: 'ok', message: 'must be equal to one of the allowed values: true' },
    ],
    ['an extra key', { ok: true, extra: 1 }, { path: 'extra', message: 'unknown key' }],
  ])('rejects %s', (_name, doc, issue) => {
    expect(issuesOf(parseDashboardAck, 'dashboard ack', doc)).toContainEqual(issue);
  });
});

describe('parseDashboardError', () => {
  const notFound: Doc = { error: 'not_found', message: 'No task state saved' };

  it.each([
    ['a plain error', notFound],
    [
      'an error with issues',
      {
        error: 'invalid_request',
        message: 'invalid outcome',
        issues: [
          { path: 'decision_needed', message: 'is required' },
          { path: '', message: 'must be object' },
        ],
      },
    ],
  ])('accepts %s', (_name, doc) => {
    expect(parseDashboardError(doc)).toEqual(doc);
  });

  it.each<[string, Doc, ValidationIssue]>([
    [
      'an unknown error code',
      mutated(notFound, (d) => (d.error = 'teapot')),
      {
        path: 'error',
        message:
          'must be equal to one of the allowed values: "invalid_request", "unauthorized", "not_found", "method_not_allowed", "payload_too_large", "internal"',
      },
    ],
    [
      'a multi-line message',
      mutated(notFound, (d) => (d.message = 'line one\nline two')),
      {
        path: 'message',
        message: `must match pattern "${dashboardErrorSchema.properties.message.pattern}"`,
      },
    ],
    [
      '51 issues',
      mutated(
        notFound,
        (d) => (d.issues = Array.from({ length: 51 }, () => ({ path: 'x', message: 'bad' }))),
      ),
      { path: 'issues', message: 'must NOT have more than 50 items' },
    ],
  ])('rejects %s', (_name, doc, issue) => {
    expect(issuesOf(parseDashboardError, 'dashboard error', doc)).toContainEqual(issue);
  });
});

describe('toDashboardErrorIssues', () => {
  it('keeps short issues unchanged', () => {
    const issues = [{ path: 'repo', message: 'is required' }];
    expect(toDashboardErrorIssues(issues)).toEqual(issues);
  });

  it('fits long paths, long messages and too many issues into a valid error body', () => {
    const issues = [
      { path: 'k'.repeat(600), message: 'unknown key' },
      { path: '', message: 'm'.repeat(600) },
      { path: '\u{1F600}'.repeat(600), message: 'unknown key' },
      ...Array.from({ length: 60 }, () => ({ path: 'x', message: 'bad' })),
    ];
    const fitted = toDashboardErrorIssues(issues);
    expect(fitted).toHaveLength(DASHBOARD_ERROR_MAX_ISSUES);
    expect(fitted[0]?.path).toBe(`${'k'.repeat(497)}...`);
    expect(fitted[1]?.message).toHaveLength(DASHBOARD_ERROR_ISSUE_MAX_LENGTH);
    expect(Array.from(fitted[2]?.path ?? '')).toHaveLength(DASHBOARD_ERROR_ISSUE_MAX_LENGTH);
    expect(() =>
      parseDashboardError({ error: 'invalid_request', message: 'invalid outcome', issues: fitted }),
    ).not.toThrow();
  });
});

describe('dashboardApiEndpoints', () => {
  it('lists exactly the four endpoints', () => {
    expect(dashboardApiEndpoints.map((e) => e.id)).toEqual([
      'save_task_state',
      'load_task_state',
      'post_outcome',
      'post_notification',
    ]);
  });

  it('puts every path under /v1/repos/{owner}/{name}/', () => {
    for (const endpoint of dashboardApiEndpoints) {
      expect(endpoint.path.startsWith('/v1/repos/{owner}/{name}/')).toBe(true);
    }
  });

  it('has unique (method, path) pairs', () => {
    const pairs = dashboardApiEndpoints.map((e) => `${e.method} ${e.path}`);
    expect(new Set(pairs).size).toBe(pairs.length);
  });
});

describe('DASHBOARD_ERROR_STATUS', () => {
  it('maps every error code to its status', () => {
    expect(DASHBOARD_ERROR_STATUS).toEqual({
      invalid_request: 400,
      unauthorized: 401,
      not_found: 404,
      method_not_allowed: 405,
      payload_too_large: 413,
      internal: 500,
    });
  });
});

describe('dashboardApiPath', () => {
  it('encodes each segment of a task-state path', () => {
    expect(dashboardApiPath('save_task_state', { repo: 'octo/repo', task_id: 'dep:1' })).toBe(
      '/v1/repos/octo/repo/tasks/dep%3A1/state',
    );
  });

  it('builds a repo-only path', () => {
    expect(dashboardApiPath('post_outcome', { repo: 'octo/repo' })).toBe(
      '/v1/repos/octo/repo/outcomes',
    );
  });

  it.each<[string, Parameters<typeof dashboardApiPath>]>([
    ['repo without a name', ['post_outcome', { repo: 'octo' }]],
    ['repo with a .. owner', ['post_outcome', { repo: '../x' }]],
    ['a missing task_id', ['load_task_state', { repo: 'octo/repo' }]],
    ['an invalid task_id', ['load_task_state', { repo: 'octo/repo', task_id: '../secret' }]],
  ])('throws RangeError for %s without echoing the value', (_name, args) => {
    let caught: unknown;
    try {
      dashboardApiPath(...args);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(RangeError);
    const message = (caught as RangeError).message;
    expect(message).not.toContain(args[1].repo);
    if (args[1].task_id !== undefined) expect(message).not.toContain(args[1].task_id);
  });
});

describe('matchDashboardApiRoute', () => {
  it.each(dashboardApiEndpoints.map((e) => [e.id, e] as const))(
    'round-trips %s',
    (_id, endpoint) => {
      const params = endpoint.path.includes('{task_id}')
        ? { repo: 'octo/repo.js', task_id: 'dep-updates:1' }
        : { repo: 'octo/repo.js' };
      expect(
        matchDashboardApiRoute(endpoint.method, dashboardApiPath(endpoint.id, params)),
      ).toEqual({ kind: 'match', endpoint, params });
    },
  );

  it('returns method_not_allowed with the allowed methods', () => {
    const match = matchDashboardApiRoute('DELETE', '/v1/repos/octo/repo/tasks/t1/state');
    expect(match.kind).toBe('method_not_allowed');
    if (match.kind !== 'method_not_allowed') return;
    expect(match.allow).toContain('GET');
    expect(match.allow).toContain('PUT');
  });

  it.each([
    ['an unknown path', '/v1/nope'],
    ['bad percent-encoding', '/v1/repos/octo/repo/tasks/%E0%A4%A/state'],
    ['a .. owner', '/v1/repos/../repo/outcomes'],
    ['an invalid task id', '/v1/repos/octo/repo/tasks/-bad/state'],
    ['a trailing slash', '/v1/repos/octo/repo/outcomes/'],
  ])('returns not_found for %s', (_name, pathname) => {
    expect(matchDashboardApiRoute('GET', pathname)).toEqual({ kind: 'not_found' });
  });
});

describe('dashboard generated types', () => {
  it('generates the expected shapes', () => {
    expectTypeOf<DashboardError['error']>().toEqualTypeOf<
      | 'invalid_request'
      | 'unauthorized'
      | 'not_found'
      | 'method_not_allowed'
      | 'payload_too_large'
      | 'internal'
    >();
    expectTypeOf<DashboardAck['ok']>().toEqualTypeOf<true>();
    expectTypeOf<DashboardRequestHeaders['authorization']>().toEqualTypeOf<string>();
  });
});
