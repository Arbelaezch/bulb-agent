import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FileWakeSource, RunnerInputError } from '../src/wake-sources/file.js';

async function tmp(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'bulb-runner-'));
}

describe('FileWakeSource', () => {
  it('reads and parses a JSON file', async () => {
    const file = join(await tmp(), 'event.json');
    await writeFile(file, JSON.stringify({ a: 1 }));
    await expect(new FileWakeSource(file).readEvent()).resolves.toEqual({ a: 1 });
  });

  it('throws RunnerInputError for a missing file', async () => {
    const file = join(await tmp(), 'missing.json');
    const err = await new FileWakeSource(file).readEvent().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RunnerInputError);
    expect((err as Error).message).toBe(`${file}: cannot read file (ENOENT)`);
  });

  it('throws RunnerInputError for invalid JSON without echoing the content', async () => {
    const file = join(await tmp(), 'bad.json');
    await writeFile(file, 'SECRET-VALUE-123');
    const err = await new FileWakeSource(file).readEvent().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RunnerInputError);
    expect((err as Error).message).toBe(`${file}: not valid JSON`);
    expect((err as Error).message).not.toContain('SECRET-VALUE-123');
  });
});
