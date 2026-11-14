import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const binPath = fileURLToPath(new URL('../dist/bin.js', import.meta.url));

const event = {
  id: 'evt-1',
  source: 'bulb',
  type: 'check.completed',
  repo: 'example-owner/example-repo',
  payload: {},
  depth: 0,
};

async function setup(doc: unknown): Promise<{ dir: string; file: string }> {
  const dir = await mkdtemp(join(tmpdir(), 'bulb-runner-'));
  await mkdir(join(dir, '.bulb'));
  await writeFile(
    join(dir, '.bulb', 'config.yaml'),
    'version: 1\nresponsibilities:\n  ci-fix: {}\n',
  );
  const file = join(dir, 'event.json');
  await writeFile(file, JSON.stringify(doc));
  return { dir, file };
}

function bin(dir: string, file: string): ReturnType<typeof spawnSync> {
  if (!existsSync(binPath)) throw new Error(`${binPath} is missing: run npm run build first`);
  return spawnSync(process.execPath, [binPath, 'run', '--event', file], {
    cwd: dir,
    encoding: 'utf8',
  });
}

describe('bulb bin', () => {
  it('exits 0 with one skipped outcome line for an unhandled event', async () => {
    const { dir, file } = await setup(event);
    const result = bin(dir, file);
    expect(result.status).toBe(0);
    const lines = String(result.stdout)
      .split('\n')
      .filter((l) => l !== '');
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? '')).toMatchObject({ outcome: 'skipped', responsibility: null });
  });

  it('exits 2 for an invalid event', async () => {
    const { dir, file } = await setup({ ...event, depth: -1 });
    const result = bin(dir, file);
    expect(result.status).toBe(2);
    expect(result.stdout).toBe('');
  });
});
