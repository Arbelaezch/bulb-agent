// Adapter interfaces. Everything around the contract is an adapter; these types stay provider-free so that
// provider-specific code (a model vendor, a git host SDK) lives only in adapter implementations.
import type { Outcome, TaskState } from './contract.js';

/**
 * The environment the runner executes in (e.g. a CI job or a local shell): where the checked-out repo lives and how
 * secrets are read. Secret values are never logged, printed, or passed to an engine.
 */
export interface Host {
  readonly workspaceDir: string;
  getSecret(name: string): string | undefined;
}

/**
 * Where wake events come from (a file, a webhook, a schedule). Returns the raw event; the runner validates it.
 */
export interface WakeSource {
  readEvent(): Promise<unknown>;
}

/** One file change. `path` is repo-relative; `content: null` deletes the file. */
export interface FileEdit {
  path: string;
  content: string | null;
}

/** What the runner hands an engine: the task, its context, the tools it may use and its budget. */
export interface EngineRequest {
  taskId: string;
  instructions: string;
  context: readonly { path: string; content: string }[];
  allowedTools: readonly string[];
  budget: { cad: number; minutes: number };
}

/** What an engine hands back: proposed edits, a transcript and what it cost. */
export interface EngineResult {
  edits: readonly FileEdit[];
  transcript: readonly string[];
  cost: { cad: number; minutes: number };
}

/**
 * The model-driven worker that proposes edits for a task. The runner enforces scope and budget on the result; it
 * never relies on the engine to stay in bounds.
 */
export interface Engine {
  run(request: EngineRequest, signal?: AbortSignal): Promise<EngineResult>;
}

/** A proposed change: a branch, a title and body, and the edits to apply. */
export interface ChangeRequest {
  branch: string;
  title: string;
  body: string;
  edits: readonly FileEdit[];
}

/** A reference to a proposed change (e.g. a pull request). */
export interface ChangeRef {
  id: string;
  url?: string;
}

/** How changes reach the target repo (e.g. a pull request on a git host). */
export interface ChangeChannel {
  propose(change: ChangeRequest): Promise<ChangeRef>;
}

/** Where outcomes are reported (stdout, a webhook, a PR comment, the dashboard). */
export interface Reporter {
  report(outcome: Outcome): Promise<void>;
}

/** Where task state is kept between wake-ups (a PR comment, the dashboard, memory in tests). */
export interface StateStore {
  load(repo: string, taskId: string): Promise<TaskState | undefined>;
  save(repo: string, state: TaskState): Promise<void>;
}
