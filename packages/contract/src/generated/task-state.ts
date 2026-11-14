/* Generated from src/schemas/task-state.schema.json by `npm run generate`. Do not edit by hand. */

/**
 * The state a task carries between wake-ups. Stored as compact JSON in a hidden PR comment, so it must be at most 10,240 bytes serialised. It never holds logs, transcripts or free text.
 */
export interface TaskState {
  /**
   * Version of the stored state format, so it can be migrated later.
   */
  version: 1;
  /**
   * Id of the task this state belongs to.
   */
  task_id: string;
  /**
   * The responsibility the task belongs to.
   */
  responsibility: 'dep-updates' | 'vuln-patch' | 'ci-fix';
  /**
   * How many attempts the task has made so far.
   */
  attempts: number;
  /**
   * Model spend so far in Canadian dollars, summed across wake-ups.
   */
  cost_so_far_cad: number;
  /**
   * Runner wall time so far in minutes, summed across wake-ups (CI waiting not counted).
   */
  minutes_so_far: number;
  /**
   * running: the task is working. waiting: the task is asleep until an event or its deadline. done, ready, blocked, error or skipped: the outcome the task ended in.
   */
  phase: 'running' | 'waiting' | 'done' | 'ready' | 'blocked' | 'error' | 'skipped';
  /**
   * When a waiting task gives up waiting, as a UTC timestamp from Date#toISOString; required when phase is waiting.
   */
  deadline?: string;
  /**
   * The event or task that started this task.
   */
  caused_by: {
    /**
     * Whether the cause is an event or a task.
     */
    kind: 'event' | 'task';
    /**
     * Id of the causing event or task.
     */
    id: string;
  };
}
