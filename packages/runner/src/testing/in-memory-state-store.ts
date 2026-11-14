import type { StateStore } from '../adapters.js';
import { parseTaskState } from '../contract.js';
import type { TaskState } from '../contract.js';

/** A state store that keeps task state in memory, keyed by repo and task id. For tests and local runs. */
export class InMemoryStateStore implements StateStore {
  readonly #states = new Map<string, TaskState>();

  async load(repo: string, taskId: string): Promise<TaskState | undefined> {
    const state = this.#states.get(key(repo, taskId));
    return state === undefined ? undefined : structuredClone(state);
  }

  async save(repo: string, state: TaskState): Promise<void> {
    // parseTaskState validates and returns a clone, so later changes to `state` don't reach the store.
    const valid = parseTaskState(state);
    this.#states.set(key(repo, valid.task_id), valid);
  }
}

function key(repo: string, taskId: string): string {
  return JSON.stringify([repo, taskId]);
}
