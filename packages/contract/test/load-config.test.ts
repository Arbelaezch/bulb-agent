import { readFileSync } from 'node:fs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BulbConfigError,
  loadBulbConfig,
  parseBulbConfig,
  readBulbConfigFile,
} from '../src/index.js';

const fixture = (name: string): string =>
  fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

/** The first ```yaml block after "### Bulb config" in docs/mvp.md, so the doc example and the schema can't diverge. */
function mvpExampleYaml(): string {
  const doc = readFileSync(new URL('../../../docs/mvp.md', import.meta.url), 'utf8');
  const section = doc.slice(doc.indexOf('### Bulb config'));
  const match = /```yaml\n([\s\S]*?)```/.exec(section);
  if (!match?.[1]) throw new Error('no yaml block after "### Bulb config" in docs/mvp.md');
  return match[1];
}

function issuesOf(fn: () => unknown): { path: string; message: string }[] {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(BulbConfigError);
    return [...(err as BulbConfigError).issues];
  }
  throw new Error('expected BulbConfigError');
}

describe('defaults', () => {
  it('fills every default for a minimal config', async () => {
    const config = await readBulbConfigFile(fixture('minimal.yaml'));
    expect(config).toEqual({
      version: 1,
      engine: { provider: 'anthropic', effort: 'medium' },
      context: { include: [] },
      verify: { commands: [], working_directory: '.', timeout: '2h' },
      merge: { auto_merge: false, require_verified: true },
      notify: { on: ['ready', 'blocked', 'error'] },
      responsibilities: { 'vuln-patch': { enabled: true, directories: ['.'] } },
      budget: { per_task_cad: 1, per_task_minutes: 15 },
      safety: {
        never_touch: ['.env*', '**/secrets/**'],
        never_push_default_branch: true,
        never_force_push: true,
        workflow_files: 'blocked',
      },
    });
  });

  it('fills responsibility defaults', () => {
    const config = parseBulbConfig({
      version: 1,
      responsibilities: { 'dep-updates': {}, 'ci-fix': {} },
    });
    expect(config.responsibilities['dep-updates']).toEqual({
      enabled: true,
      schedule: 'weekly',
      directories: ['.'],
      allow: ['patch', 'minor'],
      min_release_age: '7d',
      hold: {},
      group: 'weekly',
    });
    expect(config.responsibilities['ci-fix']).toEqual({
      enabled: true,
      attempts: 2,
      max_diff_lines: 200,
    });
  });

  it('loads the docs/mvp.md example and keeps the webhook as an opaque string', () => {
    const config = loadBulbConfig(mvpExampleYaml());
    expect(config.notify.webhook).toBe('${{ secrets.BULB_WEBHOOK_URL }}');
    expect(config.notify.on).toEqual(['ready', 'blocked', 'error']);
    expect(config.responsibilities['dep-updates']?.directories).toEqual(['apps/web/family-food']);
    expect(config.responsibilities['dep-updates']?.min_release_age).toBe('7d');
    expect(config.verify.timeout).toBe('2h');
    expect(config.budget.per_task_cad).toBe(1);
  });

  it('does not mutate its input', () => {
    const input = { version: 1, responsibilities: { 'ci-fix': {} } };
    parseBulbConfig(input);
    expect(input).toEqual({ version: 1, responsibilities: { 'ci-fix': {} } });
  });
});

describe('errors', () => {
  const base = { version: 1, responsibilities: { 'ci-fix': {} } };

  it('names unknown keys by path', () => {
    expect(issuesOf(() => parseBulbConfig({ ...base, budget: { per_task_usd: 1 } }))).toEqual([
      { path: 'budget.per_task_usd', message: 'unknown key' },
    ]);
  });

  it.each([
    {
      name: 'per_task_usd in the MVP example',
      yaml: () => mvpExampleYaml().replace('per_task_cad', 'per_task_usd'),
      path: 'budget.per_task_usd',
    },
    {
      name: 'notify.on with skipped',
      yaml: () => 'version: 1\nresponsibilities: { ci-fix: {} }\nnotify: { on: [ready, skipped] }',
      path: 'notify.on[1]',
    },
    { name: 'missing responsibilities', yaml: () => 'version: 1', path: 'responsibilities' },
    {
      name: 'empty responsibilities',
      yaml: () => 'version: 1\nresponsibilities: {}',
      path: 'responsibilities',
    },
    {
      name: 'version 2',
      yaml: () => 'version: 2\nresponsibilities: { ci-fix: {} }',
      path: 'version',
    },
    {
      name: 'workflow_files allowed',
      yaml: () =>
        'version: 1\nresponsibilities: { ci-fix: {} }\nsafety: { workflow_files: allowed }',
      path: 'safety.workflow_files',
    },
    {
      name: 'verify.timeout 2 hours',
      yaml: () => 'version: 1\nresponsibilities: { ci-fix: {} }\nverify: { timeout: 2 hours }',
      path: 'verify.timeout',
    },
    {
      name: 'unknown responsibility',
      yaml: () => 'version: 1\nresponsibilities: { ci-fix: {}, foo: {} }',
      path: 'responsibilities.foo',
    },
  ])('rejects $name at $path', ({ yaml, path }) => {
    const text = yaml();
    expect(() => loadBulbConfig(text)).toThrow(BulbConfigError);
    expect(issuesOf(() => loadBulbConfig(text)).map((issue) => issue.path)).toContain(path);
  });

  it('names missing required keys', () => {
    expect(issuesOf(() => parseBulbConfig({}))).toEqual([
      { path: 'version', message: 'is required' },
      { path: 'responsibilities', message: 'is required' },
    ]);
  });

  it('uses bracket paths for array items and lists allowed enum values', () => {
    const issues = issuesOf(() =>
      parseBulbConfig({ ...base, notify: { on: ['ready', 'blocked', 'error', 'bogus'] } }),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]?.path).toBe('notify.on[3]');
    expect(issues[0]?.message).toContain('"started", "ready", "blocked", "error", "done"');
  });

  it('keeps hyphenated responsibility keys in the path', () => {
    const issues = issuesOf(() =>
      parseBulbConfig({ version: 1, responsibilities: { 'ci-fix': { attempts: 'two' } } }),
    );
    expect(issues).toEqual([
      { path: 'responsibilities.ci-fix.attempts', message: 'must be integer' },
    ]);
  });

  it('reports a wrong root type at (root)', () => {
    const issues = issuesOf(() => parseBulbConfig([]));
    expect(issues[0]?.path).toBe('');
    expect(() => parseBulbConfig([])).toThrow('(root): must be object');
  });

  it('rejects an empty responsibilities map and bad durations', () => {
    expect(issuesOf(() => parseBulbConfig({ version: 1, responsibilities: {} }))[0]?.path).toBe(
      'responsibilities',
    );
    expect(issuesOf(() => parseBulbConfig({ ...base, verify: { timeout: '0h' } }))[0]?.path).toBe(
      'verify.timeout',
    );
  });

  it('formats the message with one line per issue and never includes values', () => {
    const secret = 'https://hooks.example.com/SECRET-TOKEN';
    let message = '';
    let issues = '';
    try {
      parseBulbConfig({
        ...base,
        notify: { webhook: secret, on: 'ready' },
        budget: { extra: secret },
      });
    } catch (err) {
      message = (err as Error).message;
      issues = JSON.stringify((err as BulbConfigError).issues);
    }
    expect(message.startsWith('Invalid bulb config:\n  ')).toBe(true);
    expect(message).toContain('\n  budget.extra: unknown key');
    expect(message).not.toContain('SECRET-TOKEN');
    expect(issues).toContain('budget.extra');
    expect(issues).not.toContain('SECRET-TOKEN');
  });

  it('reports YAML syntax errors with a position and no source', () => {
    const issues = issuesOf(() =>
      loadBulbConfig('version: 1\nresponsibilities: [unclosed\nSECRET: x'),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]?.path).toBe('');
    expect(issues[0]?.message).toMatch(/^YAML syntax error at line \d+, column \d+ \([A-Z_]+\)$/);
  });

  it('reports an empty file', () => {
    expect(issuesOf(() => loadBulbConfig(''))).toEqual([{ path: '', message: 'config is empty' }]);
  });

  it('prefixes file errors with the path', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'bulb-config-'));
    const file = join(dir, 'config.yaml');
    await writeFile(file, 'version: 2\nresponsibilities: {}\n');
    await expect(readBulbConfigFile(file)).rejects.toThrow(`${file}: Invalid bulb config:`);
    await expect(readBulbConfigFile(file)).rejects.toBeInstanceOf(BulbConfigError);
  });
});
