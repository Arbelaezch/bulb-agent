import { randomUUID } from 'node:crypto';
import { parseWakeEvent } from './contract.js';
import type { Outcome, WakeEvent } from './contract.js';

/**
 * Turns an outcome into a wake event so a later manager can listen to it. `depth` is the depth of the event that
 * started the task; the new event sits one level deeper. This helper does not refuse depth itself: the runner
 * refuses events past the maximum at intake.
 */
export function outcomeToWakeEvent(
  outcome: Outcome,
  options: { depth: number; id?: string },
): WakeEvent {
  return parseWakeEvent({
    id: options.id ?? randomUUID(),
    source: 'bulb',
    type: `bulb.outcome.${outcome.outcome}`,
    repo: outcome.repo,
    payload: { outcome: structuredClone(outcome) },
    depth: options.depth + 1,
    caused_by: { kind: 'task', id: outcome.task_id },
  });
}
