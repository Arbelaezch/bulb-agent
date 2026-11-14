import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dashboardApiPath, parseDashboardError } from '../src/index.js';
import type { TaskState } from '../src/index.js';
import { startMockDashboardServer } from '../src/testing/index.js';
import type { MockDashboardServer } from '../src/testing/index.js';

type Doc = Record<string, unknown>;

const load = (name: string): Doc =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')) as Doc;

const state = load('task-state-waiting.json');
const outcomeReady = load('outcome-ready.json');
const outcomeBlocked = load('outcome-blocked.json');
const notification = load('lifecycle-notification.json');
const repo = outcomeReady.repo as string;
const taskId = state.task_id as string;
const TOKEN = 'test-token-123';

let server: MockDashboardServer;

beforeEach(async () => {
  server = await startMockDashboardServer({ token: TOKEN });
});

afterEach(async () => {
  await server.close();
});

function send(
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = { authorization: `Bearer ${TOKEN}` },
): Promise<Response> {
  const init: RequestInit = { method, headers: { 'content-type': 'application/json', ...headers } };
  if (body !== undefined) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  return fetch(`${server.url}${path}`, init);
}

const statePath = (id = taskId) => dashboardApiPath('save_task_state', { repo, task_id: id });
const outcomePath = (r = repo) => dashboardApiPath('post_outcome', { repo: r });
const notificationPath = () => dashboardApiPath('post_notification', { repo });

describe('mock dashboard server', () => {
  it('saves then loads a task state', async () => {
    const saved = await send('PUT', statePath(), state);
    expect(saved.status).toBe(200);
    expect(await saved.json()).toEqual({ ok: true });
    const loaded = await send('GET', statePath());
    expect(loaded.status).toBe(200);
    expect(await loaded.json()).toEqual(state);
    expect(server.taskState(repo, taskId)).toEqual(state);
  });

  it('loads a seeded state', async () => {
    server.seedTaskState(repo, state as unknown as TaskState);
    const loaded = await send('GET', statePath());
    expect(loaded.status).toBe(200);
    expect(await loaded.json()).toEqual(state);
  });

  it('returns 404 when no state was saved', async () => {
    const res = await send('GET', statePath());
    expect(res.status).toBe(404);
    expect(parseDashboardError(await res.json()).error).toBe('not_found');
  });

  it('replaces an outcome posted twice', async () => {
    expect((await send('POST', outcomePath(), outcomeReady)).status).toBe(200);
    expect((await send('POST', outcomePath(), outcomeReady)).status).toBe(200);
    expect(server.outcomes()).toHaveLength(1);
  });

  it('stores a notification', async () => {
    const res = await send('POST', notificationPath(), notification);
    expect(res.status).toBe(200);
    expect(server.notifications()).toEqual([notification]);
  });

  it('rejects a missing or wrong token with 401 and never echoes it', async () => {
    const missing = await send('GET', statePath(), undefined, {});
    expect(missing.status).toBe(401);
    const wrong = await send('GET', statePath(), undefined, {
      authorization: 'Bearer wrong-token-value',
    });
    expect(wrong.status).toBe(401);
    const text = await wrong.text();
    expect(parseDashboardError(JSON.parse(text)).error).toBe('unauthorized');
    expect(text).not.toContain('wrong-token-value');
    expect(JSON.stringify(server.requests)).not.toContain('wrong-token-value');
  });

  it('rejects an invalid outcome with issues', async () => {
    const bad = structuredClone(outcomeBlocked);
    delete bad.decision_needed;
    const res = await send('POST', outcomePath(), bad);
    expect(res.status).toBe(400);
    const body = parseDashboardError(await res.json());
    expect(body.error).toBe('invalid_request');
    expect(body.issues).toContainEqual({ path: 'decision_needed', message: 'is required' });
  });

  it('answers 400 with truncated issue paths for a very long unknown key', async () => {
    const longKey = 'k'.repeat(600);
    const res = await send('POST', outcomePath(), { ...outcomeReady, [longKey]: true });
    expect(res.status).toBe(400);
    const body = parseDashboardError(await res.json());
    expect(body.error).toBe('invalid_request');
    const issue = body.issues?.find((i) => i.message === 'unknown key');
    expect(issue?.path).toHaveLength(500);
    expect(issue?.path.endsWith('...')).toBe(true);
    expect(server.requests.at(-1)).toMatchObject({ endpoint: 'post_outcome', status: 400 });
  });

  it('rejects malformed JSON', async () => {
    const res = await send('POST', outcomePath(), '{not json');
    expect(res.status).toBe(400);
    expect(parseDashboardError(await res.json()).error).toBe('invalid_request');
  });

  it('rejects a body that disagrees with the path', async () => {
    const stateRes = await send('PUT', statePath('other-task'), state);
    expect(stateRes.status).toBe(400);
    expect(parseDashboardError(await stateRes.json()).issues?.[0]?.path).toBe('task_id');

    const outcomeRes = await send('POST', outcomePath('someone/else'), outcomeReady);
    expect(outcomeRes.status).toBe(400);
    expect(parseDashboardError(await outcomeRes.json()).issues?.[0]?.path).toBe('repo');
  });

  it('rejects a body over 1 MiB with 413', async () => {
    const res = await send('POST', outcomePath(), 'x'.repeat(1_100_000));
    expect(res.status).toBe(413);
    expect(parseDashboardError(await res.json()).error).toBe('payload_too_large');
  });

  it('gives 405 with Allow for a wrong method and 404 for an unknown path', async () => {
    const wrong = await send('DELETE', statePath());
    expect(wrong.status).toBe(405);
    expect(wrong.headers.get('allow')).toContain('GET');
    expect((await send('GET', '/v1/nope')).status).toBe(404);
  });

  it('records requests without headers or bodies', async () => {
    await send('PUT', statePath(), state);
    expect(server.requests).toContainEqual(
      expect.objectContaining({ method: 'PUT', endpoint: 'save_task_state', status: 200 }),
    );
    expect(JSON.stringify(server.requests).toLowerCase()).not.toContain('authorization');
  });

  it('reset clears stores and requests', async () => {
    await send('PUT', statePath(), state);
    server.reset();
    expect(server.requests).toHaveLength(0);
    expect(server.taskState(repo, taskId)).toBeUndefined();
  });

  it('rejects an empty token', async () => {
    await expect(startMockDashboardServer({ token: '' })).rejects.toThrow(TypeError);
  });
});
