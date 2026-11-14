import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseOutcome, parseWakeEvent } from '../src/contract.js';
import type { Outcome } from '../src/contract.js';
import { outcomeToWakeEvent } from '../src/outcome-event.js';

const outcome = parseOutcome(
  JSON.parse(
    readFileSync(
      new URL('../../contract/test/fixtures/outcome-ready.json', import.meta.url),
      'utf8',
    ),
  ),
);

describe('outcomeToWakeEvent', () => {
  it('builds a wake event one level deeper, caused by the task', () => {
    const event = outcomeToWakeEvent(outcome, { depth: 2 });

    expect(event.depth).toBe(3);
    expect(event.caused_by).toEqual({ kind: 'task', id: outcome.task_id });
    expect(event.source).toBe('bulb');
    expect(event.type).toBe('bulb.outcome.ready');
    expect(event.repo).toBe(outcome.repo);
    expect(event.payload['outcome']).toEqual(outcome);
    expect(event.payload['outcome']).not.toBe(outcome);
    expect(parseWakeEvent(event)).toEqual(event);
  });

  it('uses a given id', () => {
    expect(outcomeToWakeEvent(outcome, { depth: 0, id: 'evt-outcome.1' }).id).toBe('evt-outcome.1');
  });

  it('generates a valid id by default', () => {
    const first = outcomeToWakeEvent(outcome, { depth: 0 });
    const second = outcomeToWakeEvent(outcome, { depth: 0 });

    expect(first.id).toMatch(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
    expect(first.id).not.toBe(second.id);
  });

  it('works from a root event', () => {
    expect(outcomeToWakeEvent(outcome, { depth: 0 }).depth).toBe(1);
  });

  it('works for a skipped outcome with a null responsibility', () => {
    const skipped: Outcome = parseOutcome({
      ...structuredClone(outcome),
      outcome: 'skipped',
      responsibility: null,
    });

    const event = outcomeToWakeEvent(skipped, { depth: 1 });

    expect(event.type).toBe('bulb.outcome.skipped');
    expect(event.payload['outcome']).toEqual(skipped);
    expect(parseWakeEvent(event)).toEqual(event);
  });

  it('does not mutate the outcome', () => {
    const before = structuredClone(outcome);
    outcomeToWakeEvent(outcome, { depth: 0 });
    expect(outcome).toEqual(before);
  });
});
