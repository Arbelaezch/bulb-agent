/* Generated from src/schemas/bulb-config.schema.json by `npm run generate`. Do not edit by hand. */

/**
 * Bulb config as written in `.bulb/config.yaml`; keys with defaults are optional.
 */
export interface BulbConfigInput {
  /**
   * Config format version; must be 1.
   */
  version: 1;
  /**
   * Which model engine the bulb uses. Default: {}.
   */
  engine?: {
    /**
     * Engine provider name. Default: "anthropic".
     */
    provider?: string;
    /**
     * Model id; when omitted the engine adapter picks one. No default.
     */
    model?: string;
    /**
     * How much reasoning effort the engine spends. Default: "medium".
     */
    effort?: 'low' | 'medium' | 'high';
  };
  /**
   * Extra repo context given to the engine. Default: {}.
   */
  context?: {
    /**
     * Repo paths or globs to include as context. Default: [].
     */
    include?: string[];
  };
  /**
   * How a change is verified before it is reported ready. Default: {}.
   */
  verify?: {
    /**
     * Commands run locally to verify a change, in order. Default: [].
     */
    commands?: string[];
    /**
     * Directory the verify commands run in, relative to the repo root. Default: ".".
     */
    working_directory?: string;
    /**
     * How long to wait for the repo's CI checks, as <integer><unit> with unit m (minutes), h (hours) or d (days). Default: "2h".
     */
    timeout?: string;
  };
  /**
   * Merge behaviour for the bulb's PRs. Default: {}.
   */
  merge?: {
    /**
     * Whether the bulb may merge its own PRs. Default: false.
     */
    auto_merge?: boolean;
    /**
     * Whether a PR must pass verification before it is reported ready or merged. Default: true.
     */
    require_verified?: boolean;
  };
  /**
   * Where and when the owner is notified. Default: {}.
   */
  notify?: {
    /**
     * Webhook URL, or a secret reference such as ${{ secrets.NAME }}; kept as an opaque string. No default.
     */
    webhook?: string;
    /**
     * Lifecycle events and outcomes that trigger a notification. Default: ["ready", "blocked", "error"].
     */
    on?: ('started' | 'ready' | 'blocked' | 'error' | 'done')[];
  };
  /**
   * The responsibilities this bulb has; a responsibility is configured when its key is present. At least one is required.
   */
  responsibilities: {
    /**
     * Keep dependencies up to date with grouped patch and minor bumps. No default.
     */
    'dep-updates'?: {
      /**
       * Whether this responsibility runs. Default: true.
       */
      enabled?: boolean;
      /**
       * How often the bulb wakes to check for updates. Default: "weekly".
       */
      schedule?: 'daily' | 'weekly' | 'monthly';
      /**
       * Directories (relative to the repo root) whose manifests and lockfiles may be edited. Default: ["."].
       *
       * @minItems 1
       */
      directories?: [string, ...string[]];
      /**
       * Update kinds included in the grouped PR; majors always get their own PR. Default: ["patch", "minor"].
       */
      allow?: ('patch' | 'minor')[];
      /**
       * Minimum age of a release before it is picked up, as <integer><unit> with unit m (minutes), h (hours) or d (days); 0d means no waiting. Default: "7d".
       */
      min_release_age?: string;
      /**
       * Packages held back, mapped to the reason they are held. Default: {}.
       */
      hold?: {
        [k: string]: string;
      };
      /**
       * How patch and minor bumps are grouped into one PR. Default: "weekly".
       */
      group?: 'weekly';
    };
    /**
     * Patch known vulnerabilities in dependencies. No default.
     */
    'vuln-patch'?: {
      /**
       * Whether this responsibility runs. Default: true.
       */
      enabled?: boolean;
      /**
       * Directories (relative to the repo root) whose manifests and lockfiles may be edited. Default: ["."].
       *
       * @minItems 1
       */
      directories?: [string, ...string[]];
    };
    /**
     * Fix failing CI checks on PRs another responsibility opened, within that responsibility's directories. No default.
     */
    'ci-fix'?: {
      /**
       * Whether this responsibility runs. Default: true.
       */
      enabled?: boolean;
      /**
       * Maximum fix attempts per PR. Default: 2.
       */
      attempts?: number;
      /**
       * Maximum changed lines in one fix. Default: 200.
       */
      max_diff_lines?: number;
    };
  };
  /**
   * Per-task limits, summed across wake-ups. Default: {}.
   */
  budget?: {
    /**
     * Maximum model spend per task, in Canadian dollars. Default: 1.
     */
    per_task_cad?: number;
    /**
     * Maximum runner wall time per task, in minutes (CI waiting not counted). Default: 15.
     */
    per_task_minutes?: number;
  };
  /**
   * Safety limits the runner enforces. Default: {}.
   */
  safety?: {
    /**
     * Path globs the bulb never reads into context or edits. Default: [".env*", "** /secrets/**"].
     */
    never_touch?: string[];
    /**
     * Never push to the default branch. Default: true.
     */
    never_push_default_branch?: boolean;
    /**
     * Never force-push, except to bulb/* branches the bulb opened. Default: true.
     */
    never_force_push?: boolean;
    /**
     * How workflow files are treated; bulbs never edit them. Default: "blocked".
     */
    workflow_files?: 'blocked';
  };
}

/**
 * Bulb config after loading: schema defaults applied.
 */
export interface BulbConfig {
  /**
   * Config format version; must be 1.
   */
  version: 1;
  /**
   * Which model engine the bulb uses. Default: {}.
   */
  engine: {
    /**
     * Engine provider name. Default: "anthropic".
     */
    provider: string;
    /**
     * Model id; when omitted the engine adapter picks one. No default.
     */
    model?: string;
    /**
     * How much reasoning effort the engine spends. Default: "medium".
     */
    effort: 'low' | 'medium' | 'high';
  };
  /**
   * Extra repo context given to the engine. Default: {}.
   */
  context: {
    /**
     * Repo paths or globs to include as context. Default: [].
     */
    include: string[];
  };
  /**
   * How a change is verified before it is reported ready. Default: {}.
   */
  verify: {
    /**
     * Commands run locally to verify a change, in order. Default: [].
     */
    commands: string[];
    /**
     * Directory the verify commands run in, relative to the repo root. Default: ".".
     */
    working_directory: string;
    /**
     * How long to wait for the repo's CI checks, as <integer><unit> with unit m (minutes), h (hours) or d (days). Default: "2h".
     */
    timeout: string;
  };
  /**
   * Merge behaviour for the bulb's PRs. Default: {}.
   */
  merge: {
    /**
     * Whether the bulb may merge its own PRs. Default: false.
     */
    auto_merge: boolean;
    /**
     * Whether a PR must pass verification before it is reported ready or merged. Default: true.
     */
    require_verified: boolean;
  };
  /**
   * Where and when the owner is notified. Default: {}.
   */
  notify: {
    /**
     * Webhook URL, or a secret reference such as ${{ secrets.NAME }}; kept as an opaque string. No default.
     */
    webhook?: string;
    /**
     * Lifecycle events and outcomes that trigger a notification. Default: ["ready", "blocked", "error"].
     */
    on: ('started' | 'ready' | 'blocked' | 'error' | 'done')[];
  };
  /**
   * The responsibilities this bulb has; a responsibility is configured when its key is present. At least one is required.
   */
  responsibilities: {
    /**
     * Keep dependencies up to date with grouped patch and minor bumps. No default.
     */
    'dep-updates'?: {
      /**
       * Whether this responsibility runs. Default: true.
       */
      enabled: boolean;
      /**
       * How often the bulb wakes to check for updates. Default: "weekly".
       */
      schedule: 'daily' | 'weekly' | 'monthly';
      /**
       * Directories (relative to the repo root) whose manifests and lockfiles may be edited. Default: ["."].
       *
       * @minItems 1
       */
      directories: [string, ...string[]];
      /**
       * Update kinds included in the grouped PR; majors always get their own PR. Default: ["patch", "minor"].
       */
      allow: ('patch' | 'minor')[];
      /**
       * Minimum age of a release before it is picked up, as <integer><unit> with unit m (minutes), h (hours) or d (days); 0d means no waiting. Default: "7d".
       */
      min_release_age: string;
      /**
       * Packages held back, mapped to the reason they are held. Default: {}.
       */
      hold: {
        [k: string]: string;
      };
      /**
       * How patch and minor bumps are grouped into one PR. Default: "weekly".
       */
      group: 'weekly';
    };
    /**
     * Patch known vulnerabilities in dependencies. No default.
     */
    'vuln-patch'?: {
      /**
       * Whether this responsibility runs. Default: true.
       */
      enabled: boolean;
      /**
       * Directories (relative to the repo root) whose manifests and lockfiles may be edited. Default: ["."].
       *
       * @minItems 1
       */
      directories: [string, ...string[]];
    };
    /**
     * Fix failing CI checks on PRs another responsibility opened, within that responsibility's directories. No default.
     */
    'ci-fix'?: {
      /**
       * Whether this responsibility runs. Default: true.
       */
      enabled: boolean;
      /**
       * Maximum fix attempts per PR. Default: 2.
       */
      attempts: number;
      /**
       * Maximum changed lines in one fix. Default: 200.
       */
      max_diff_lines: number;
    };
  };
  /**
   * Per-task limits, summed across wake-ups. Default: {}.
   */
  budget: {
    /**
     * Maximum model spend per task, in Canadian dollars. Default: 1.
     */
    per_task_cad: number;
    /**
     * Maximum runner wall time per task, in minutes (CI waiting not counted). Default: 15.
     */
    per_task_minutes: number;
  };
  /**
   * Safety limits the runner enforces. Default: {}.
   */
  safety: {
    /**
     * Path globs the bulb never reads into context or edits. Default: [".env*", "** /secrets/**"].
     */
    never_touch: string[];
    /**
     * Never push to the default branch. Default: true.
     */
    never_push_default_branch: boolean;
    /**
     * Never force-push, except to bulb/* branches the bulb opened. Default: true.
     */
    never_force_push: boolean;
    /**
     * How workflow files are treated; bulbs never edit them. Default: "blocked".
     */
    workflow_files: 'blocked';
  };
}
