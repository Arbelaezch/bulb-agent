/* Generated from src/schemas/outcome.schema.json by `npm run generate`. Do not edit by hand. */

/**
 * How a task ended. Every task ends in exactly one outcome; `blocked` and `error` must say which decision the owner needs to make. Outcomes are also emitted as wake events so a later manager can listen to them.
 */
export interface Outcome {
  /**
   * Id of the task that ended.
   */
  task_id: string;
  /**
   * The responsibility the task belonged to.
   */
  responsibility: 'dep-updates' | 'vuln-patch' | 'ci-fix';
  /**
   * Target repository as owner/name.
   */
  repo: string;
  /**
   * done: finished, nothing needed. ready: work is ready for approval (a PR). blocked: stopped by a rule or permission. error: something else broke and the bulb couldn't fix it within its limits. skipped: woke up but the event isn't something it handles.
   */
  outcome: 'done' | 'ready' | 'blocked' | 'error' | 'skipped';
  /**
   * One-line summary of what happened.
   */
  summary: string;
  /**
   * What the bulb tried, one entry per attempt or step.
   *
   * @maxItems 20
   */
  tried?: string[];
  /**
   * Why the task stopped.
   */
  why?: string;
  /**
   * The decision the owner needs to make; required when the outcome is blocked or error.
   */
  decision_needed?: string;
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
  /**
   * The verification signal used: the repo's CI checks, a platform check, the configured verify commands, or none.
   */
  verification_signal?: 'ci_checks' | 'platform_check' | 'verify_commands' | 'none';
  /**
   * What the task cost, summed across wake-ups.
   */
  cost: {
    /**
     * Model spend in Canadian dollars.
     */
    cad: number;
    /**
     * Runner wall time in minutes (CI waiting not counted).
     */
    minutes: number;
  };
}
