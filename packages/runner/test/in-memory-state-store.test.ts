import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ContractValidationError, parseTaskState } from '../src/contract.js';
import type { TaskState } from '../src/contract.js';
import { InMemoryStateStore } from '../src/testing/index.js';

const state = parseTaskState(
  JSON.parse(
    readFileSync(
      new URL('../../contract/test/fixtures/task-state-waiting.json', import.meta.url),
      'utf8',
    ),
  ),
);

const repo = 'example-owner/example-repo';

describe('InMemoryStateStore', () => {
  it('returns an equal clone of a saved state', async () => {
    const store = new InMemoryStateStore();
    const input = structuredClone(state);
    await store.save(repo, input);

    input.attempts = 99;
    const loaded = await store.load(repo, state.task_id);
    expect(loaded).toEqual(state);
    expect(loaded).not.toBe(input);

    if (loaded === undefined) throw new Error('expected a stored state');
    loaded.attempts = 42;
    expect(await store.load(repo, state.task_id)).toEqual(state);
  });

  it('returns undefined for an unknown task', async () => {
    const store = new InMemoryStateStore();
    expect(await store.load(repo, 'task-unknown')).toBeUndefined();
  });

  it('keeps the same task id under two repos apart', async () => {
    const store = new InMemoryStateStore();
    const other: TaskState = { ...structuredClone(state), attempts: 2 };
    await store.save(repo, state);
    await store.save('other-owner/other-repo', other);

    expect(await store.load(repo, state.task_id)).toEqual(state);
    expect(await store.load('other-owner/other-repo', state.task_id)).toEqual(other);
  });

  it('rejects an invalid state and does not store it', async () => {
    const store = new InMemoryStateStore();
    const invalid: TaskState = { ...structuredClone(state), attempts: -1 };

    await expect(store.save(repo, invalid)).rejects.toBeInstanceOf(ContractValidationError);
    expect(await store.load(repo, state.task_id)).toBeUndefined();
  });
});
