import { parseOutcome } from './contract.js';
import type { Outcome, WakeEvent } from './contract.js';

/**
 * The outcome for an event the runner ended before any responsibility ran (unhandled type, depth refusal). No task
 * was created, so the event id stands in for the task id and nothing was spent.
 */
export function runnerOutcome(event: WakeEvent, fields: { summary: string; why: string }): Outcome {
  return parseOutcome({
    task_id: event.id,
    responsibility: null,
    repo: event.repo,
    outcome: 'skipped',
    summary: fields.summary,
    why: fields.why,
    cost: { cad: 0, minutes: 0 },
  });
}
