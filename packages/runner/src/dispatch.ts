import type { StateStore } from './adapters.js';
import { ContractValidationError, parseOutcome } from './contract.js';
import type { BulbConfig, Outcome, WakeEvent } from './contract.js';
import { MAX_EVENT_DEPTH, exceedsMaxDepth } from './limits.js';
import { runnerOutcome } from './outcomes.js';
import type { ResponsibilityName, ResponsibilityRegistry } from './responsibility.js';

export interface DispatchOptions {
  registry: ResponsibilityRegistry;
  config: BulbConfig;
  stateStore: StateStore;
  /** Receives value-free diagnostic lines (never error messages that could carry secrets). */
  log?: (line: string) => void;
}

/**
 * Routes a validated wake event to the configured responsibility that handles its type and returns exactly one
 * outcome. Events past the maximum depth and events no configured responsibility handles end as `skipped` with a
 * null responsibility. Never mutates `event` or `config`.
 */
export async function dispatch(event: WakeEvent, options: DispatchOptions): Promise<Outcome> {
  if (exceedsMaxDepth(event.depth)) {
    return runnerOutcome(event, {
      summary: `Refused: event depth ${event.depth} exceeds the maximum of ${MAX_EVENT_DEPTH}`,
      why: 'Events past the maximum depth are refused so a bulb cannot loop on its own events.',
    });
  }

  const responsibility = options.registry.forEventType(event.type);
  const configured =
    responsibility === undefined ? undefined : options.config.responsibilities[responsibility.name];
  if (responsibility === undefined || configured === undefined || configured.enabled === false) {
    return runnerOutcome(event, {
      summary: `No configured responsibility handles event type ${event.type}`,
      why: 'The event type has no responsibility that is both configured and enabled in this bulb.',
    });
  }

  const name = responsibility.name;
  try {
    const outcome = parseOutcome(
      await responsibility.run({
        event: structuredClone(event),
        config: structuredClone(options.config),
        stateStore: options.stateStore,
      }),
    );
    if (outcome.responsibility !== name || outcome.repo !== event.repo) {
      options.log?.(`${name} returned an outcome for another responsibility or repo`);
      return failedOutcome(event, name);
    }
    return outcome;
  } catch (err) {
    // Only the error class and contract issue paths are logged: other error text could carry secrets.
    options.log?.(describeFailure(name, err));
    return failedOutcome(event, name);
  }
}

function describeFailure(name: ResponsibilityName, err: unknown): string {
  if (err instanceof ContractValidationError) {
    const issues = err.issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ');
    return `${name} returned an invalid outcome: ${issues}`;
  }
  const kind = err instanceof Error && /^\w+$/.test(err.name) ? err.name : 'a non-error value';
  return `${name} threw ${kind}`;
}

function failedOutcome(event: WakeEvent, name: ResponsibilityName): Outcome {
  return parseOutcome({
    task_id: event.id,
    responsibility: name,
    repo: event.repo,
    outcome: 'error',
    summary: `${name} failed before reporting a valid outcome`,
    why: 'The responsibility threw or returned an invalid outcome.',
    decision_needed: 'Check the run logs, then rerun or take over.',
    cost: { cad: 0, minutes: 0 },
  });
}
