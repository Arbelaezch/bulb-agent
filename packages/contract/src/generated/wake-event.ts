/* Generated from src/schemas/wake-event.schema.json by `npm run generate`. Do not edit by hand. */

/**
 * A wake event, normalised from every source (GitHub, schedule, dashboard or another bulb). Carries provenance (`caused_by` and `depth`) so the runner can refuse events past a maximum depth and a bulb can't loop on its own pushes.
 */
export interface WakeEvent {
  /**
   * Unique id of this event.
   */
  id: string;
  /**
   * Where the event came from: github, schedule, dashboard, or bulb (emitted by a bulb, e.g. an outcome).
   */
  source: 'github' | 'schedule' | 'dashboard' | 'bulb';
  /**
   * Dotted event type, e.g. dependabot.pr.opened, security.alert, check.completed, schedule.tick or action.retry.
   */
  type: string;
  /**
   * Target repository as owner/name.
   */
  repo: string;
  /**
   * Source-specific event data; never holds secrets.
   */
  payload: {
    [k: string]: unknown;
  };
  /**
   * How many events or tasks led to this one; 0 for an external root event. The runner refuses events past its maximum depth.
   */
  depth: number;
  /**
   * The event or task that led to this event; absent for an external root event, required when depth is 1 or more.
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
}
