/* Generated from src/schemas/lifecycle-notification.schema.json by `npm run generate`. Do not edit by hand. */

/**
 * A lifecycle notification sent to the owner when a task begins. It is separate from outcomes and does not end a task.
 */
export interface LifecycleNotification {
  /**
   * Which lifecycle point this is; started is sent when a task begins.
   */
  notification: 'started';
  /**
   * Id of the task.
   */
  task_id: string;
  /**
   * The responsibility the task belongs to.
   */
  responsibility: 'dep-updates' | 'vuln-patch' | 'ci-fix';
  /**
   * Target repository as owner/name.
   */
  repo: string;
  /**
   * The event or task that led to this task.
   */
  caused_by?: {
    /**
     * Whether the cause is an event or a task.
     */
    kind: 'event' | 'task';
    /**
     * Id of the causing event or task.
     */
    id: string;
  };
  /**
   * One-line summary of what the task is about to do.
   */
  summary?: string;
  /**
   * Related links: the PR, the run, logs or a check.
   *
   * @maxItems 20
   */
  links?: {
    /**
     * What the link points to.
     */
    kind: 'pr' | 'run' | 'logs' | 'check' | 'other';
    /**
     * An http or https URL.
     */
    url: string;
  }[];
}
