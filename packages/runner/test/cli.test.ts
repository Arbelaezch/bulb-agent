import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runCli } from '../src/cli.js';
import type { CliIo } from '../src/cli.js';
import { parseOutcome } from '../src/contract.js';
import { createRegistry } from '../src/responsibility.js';
import type { Responsibility, RunContext } from '../src/responsibility.js';

const USAGE = 'Usage: bulb run --event <file>';
const CONFIG = 'version: 1\nresponsibilities:\n  ci-fix: {}\n';

const baseEvent = {
  id: 'evt-1',
  source: 'bulb',
  type: 'check.completed',
  repo: 'example-owner/example-repo',
  payload: {},
  depth: 0,
};

interface Setup {
  dir: string;
  eventFile: string;
  out: string[];
  err: string[];
  io: (extra?: Partial<CliIo>) => CliIo;
}

async function setup(
  event: string | Record<string, unknown> | null = baseEvent,
  config: string | null = CONFIG,
): Promise<Setup> {
  const dir = await mkdtemp(join(tmpdir(), 'bulb-runner-'));
  if (config !== null) {
    await mkdir(join(dir, '.bulb'));
    await writeFile(join(dir, '.bulb', 'config.yaml'), config);
  }
  const eventFile = join(dir, 'event.json');
  if (event !== null) {
    await writeFile(eventFile, typeof event === 'string' ? event : JSON.stringify(event));
  }
  const out: string[] = [];
  const err: string[] = [];
  return {
    dir,
    eventFile,
    out,
    err,
    io: (extra = {}) => ({
      cwd: dir,
      stdout: (t) => out.push(t),
      stderr: (t) => err.push(t),
      ...extra,
    }),
  };
}

function ciFix(
  result: (ctx: RunContext) => Record<string, unknown>,
): Responsibility & { calls: number } {
  const r = {
    name: 'ci-fix' as const,
    eventTypes: ['check.completed'],
    calls: 0,
    run: async (ctx: RunContext) => {
      r.calls += 1;
      return parseOutcome({
        task_id: 'task-ci-fix-1',
        responsibility: 'ci-fix',
        repo: ctx.event.repo,
        outcome: 'ready',
        summary: 'Fixed.',
        cost: { cad: 0, minutes: 0 },
        ...result(ctx),
      });
    },
  };
  return r;
}

const runArgs = (s: Setup): string[] => ['run', '--event', s.eventFile];

describe('runCli', () => {
  it('skips an unhandled event type with one outcome line', async () => {
    const s = await setup();
    expect(await runCli(runArgs(s), s.io())).toBe(0);
    expect(s.out).toHaveLength(1);
    expect(s.out[0]?.endsWith('\n')).toBe(true);
    const outcome = parseOutcome(JSON.parse(s.out[0] ?? ''));
    expect(outcome.outcome).toBe('skipped');
    expect(outcome.responsibility).toBeNull();
    expect(s.err).toEqual([]);
  });

  it('refuses an event past the maximum depth as skipped', async () => {
    const s = await setup({
      ...baseEvent,
      depth: 4,
      caused_by: { kind: 'task', id: 'task-ci-fix-1' },
    });
    const stub = ciFix(() => ({}));
    expect(await runCli(runArgs(s), s.io({ registry: createRegistry([stub]) }))).toBe(0);
    const outcome = parseOutcome(JSON.parse(s.out[0] ?? ''));
    expect(outcome.outcome).toBe('skipped');
    expect(outcome.summary).toContain('depth');
    expect(stub.calls).toBe(0);
  });

  it('reports the responsibility outcome and exits 0 when ready', async () => {
    const s = await setup();
    const stub = ciFix(() => ({}));
    expect(await runCli(runArgs(s), s.io({ registry: createRegistry([stub]) }))).toBe(0);
    expect(JSON.parse(s.out[0] ?? '')).toMatchObject({
      outcome: 'ready',
      responsibility: 'ci-fix',
    });
    expect(stub.calls).toBe(1);
  });

  it('exits 1 when the outcome is blocked', async () => {
    const s = await setup();
    const stub = ciFix(() => ({
      outcome: 'blocked',
      decision_needed: 'Update the workflow yourself.',
    }));
    expect(await runCli(runArgs(s), s.io({ registry: createRegistry([stub]) }))).toBe(1);
    expect(JSON.parse(s.out[0] ?? '')).toMatchObject({ outcome: 'blocked' });
  });

  it('exits 2 for an invalid event and names the path and field', async () => {
    const s = await setup({ ...baseEvent, depth: -1 });
    expect(await runCli(runArgs(s), s.io())).toBe(2);
    const text = s.err.join('');
    expect(text).toContain('depth: must be >= 0');
    expect(text).toContain(s.eventFile);
    expect(s.out).toEqual([]);
  });

  it('exits 2 for an event missing repo', async () => {
    const rest: Record<string, unknown> = { ...baseEvent };
    delete rest.repo;
    const s = await setup(rest);
    expect(await runCli(runArgs(s), s.io())).toBe(2);
    expect(s.err.join('')).toContain('repo: is required');
    expect(s.out).toEqual([]);
  });

  it('exits 2 for a non-JSON event file without echoing it', async () => {
    const s = await setup('SECRET-VALUE-123');
    expect(await runCli(runArgs(s), s.io())).toBe(2);
    expect(s.err.join('')).toContain('not valid JSON');
    expect(s.err.join('')).not.toContain('SECRET-VALUE-123');
    expect(s.out).toEqual([]);
  });

  it('exits 2 for a missing event file', async () => {
    const s = await setup(null);
    expect(await runCli(runArgs(s), s.io())).toBe(2);
    expect(s.err.join('')).toContain('cannot read file (ENOENT)');
  });

  it('exits 2 for an invalid config', async () => {
    const s = await setup(baseEvent, 'version: 2\nresponsibilities: {}\n');
    expect(await runCli(runArgs(s), s.io())).toBe(2);
    expect(s.err.join('')).toContain('config.yaml');
    expect(s.err.join('')).toContain('version');
    expect(s.out).toEqual([]);
  });

  it('exits 2 for a missing config', async () => {
    const s = await setup(baseEvent, null);
    expect(await runCli(runArgs(s), s.io())).toBe(2);
    expect(s.err.join('')).toContain('cannot read file (ENOENT)');
    expect(s.out).toEqual([]);
  });

  it.each([
    [[]],
    [['run']],
    [['deploy', '--event', 'x.json']],
    [['run', '--event', 'x.json', '--nope']],
  ])('exits 2 with usage for bad arguments %j', async (argv: string[]) => {
    const s = await setup();
    expect(await runCli(argv, s.io())).toBe(2);
    expect(s.err.join('')).toContain(USAGE);
    expect(s.out).toEqual([]);
  });
});
