import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseBulbConfig, parseOutcome, parseWakeEvent } from '../src/contract.js';
import type { BulbConfig, Outcome, WakeEvent } from '../src/contract.js';
import { dispatch } from '../src/dispatch.js';
import { MAX_EVENT_DEPTH } from '../src/limits.js';
import { createRegistry } from '../src/responsibility.js';
import type { Responsibility, ResponsibilityName, RunContext } from '../src/responsibility.js';
import { InMemoryStateStore } from '../src/testing/index.js';

type Doc = Record<string, unknown>;

const load = (name: string): Doc =>
  JSON.parse(
    readFileSync(new URL(`../../contract/test/fixtures/${name}`, import.meta.url), 'utf8'),
  ) as Doc;

const baseEvent = parseWakeEvent(load('wake-event.json'));
const readyFixture = parseOutcome(load('outcome-ready.json'));

function event(overrides: Partial<WakeEvent> = {}): WakeEvent {
  return parseWakeEvent({ ...structuredClone(baseEvent), ...overrides });
}

function outcomeFor(name: ResponsibilityName, ev: WakeEvent): Outcome {
  return { ...structuredClone(readyFixture), responsibility: name, repo: ev.repo };
}

interface Stub extends Responsibility {
  calls: RunContext[];
}

function stub(
  name: ResponsibilityName,
  eventTypes: string[],
  result?: (context: RunContext) => unknown,
): Stub {
  const calls: RunContext[] = [];
  return {
    name,
    eventTypes,
    calls,
    run: async (context) => {
      calls.push(context);
      return (result ?? ((ctx: RunContext) => outcomeFor(name, ctx.event)))(context) as Outcome;
    },
  };
}

const bothConfigured = parseBulbConfig({
  version: 1,
  responsibilities: { 'ci-fix': {}, 'dep-updates': {} },
});

async function run(
  ev: WakeEvent,
  stubs: Responsibility[],
  config: BulbConfig = bothConfigured,
  log?: (line: string) => void,
): Promise<Outcome> {
  const before = structuredClone(ev);
  const configBefore = structuredClone(config);
  const result = await dispatch(ev, {
    registry: createRegistry(stubs),
    config,
    stateStore: new InMemoryStateStore(),
    ...(log === undefined ? {} : { log }),
  });
  expect(ev).toEqual(before);
  expect(config).toEqual(configBefore);
  expect(parseOutcome(result)).toEqual(result);
  return result;
}

describe('dispatch', () => {
  it('routes an event only to the responsibility whose eventTypes contains its type', async () => {
    const ciFix = stub('ci-fix', ['check.completed']);
    const depUpdates = stub('dep-updates', ['dependabot.pr.opened']);
    const ev = event({ type: 'check.completed' });

    const result = await run(ev, [ciFix, depUpdates]);

    expect(ciFix.calls).toHaveLength(1);
    expect(ciFix.calls[0]?.event).toEqual(ev);
    expect(ciFix.calls[0]?.config).toEqual(bothConfigured);
    expect(depUpdates.calls).toHaveLength(0);
    expect(result).toEqual(outcomeFor('ci-fix', ev));
  });

  it('routes the other type to the other responsibility', async () => {
    const ciFix = stub('ci-fix', ['check.completed']);
    const depUpdates = stub('dep-updates', ['dependabot.pr.opened']);
    const ev = event({ type: 'dependabot.pr.opened' });

    const result = await run(ev, [ciFix, depUpdates]);

    expect(depUpdates.calls).toHaveLength(1);
    expect(depUpdates.calls[0]?.event).toEqual(ev);
    expect(ciFix.calls).toHaveLength(0);
    expect(result).toEqual(outcomeFor('dep-updates', ev));
  });

  it('skips an unknown event type with a null responsibility', async () => {
    const ciFix = stub('ci-fix', ['check.completed']);
    const ev = event({ type: 'security.alert' });

    const result = await run(ev, [ciFix]);

    expect(result.outcome).toBe('skipped');
    expect(result.responsibility).toBeNull();
    expect(result.task_id).toBe(ev.id);
    expect(result.repo).toBe(ev.repo);
    expect(result.summary).toContain('security.alert');
    expect(result.cost).toEqual({ cad: 0, minutes: 0 });
    expect(ciFix.calls).toHaveLength(0);
  });

  it('skips with an empty registry', async () => {
    const result = await run(event(), []);
    expect(result.outcome).toBe('skipped');
    expect(result.responsibility).toBeNull();
  });

  it('skips a type whose responsibility is not configured', async () => {
    const vulnPatch = stub('vuln-patch', ['security.alert']);
    const result = await run(event({ type: 'security.alert' }), [vulnPatch]);

    expect(result.outcome).toBe('skipped');
    expect(result.responsibility).toBeNull();
    expect(vulnPatch.calls).toHaveLength(0);
  });

  it('skips a type whose responsibility is disabled', async () => {
    const ciFix = stub('ci-fix', ['check.completed']);
    const config = parseBulbConfig({
      version: 1,
      responsibilities: { 'ci-fix': { enabled: false }, 'dep-updates': {} },
    });

    const result = await run(event({ type: 'check.completed' }), [ciFix], config);

    expect(result.outcome).toBe('skipped');
    expect(result.responsibility).toBeNull();
    expect(ciFix.calls).toHaveLength(0);
  });

  it('dispatches an event at exactly the maximum depth', async () => {
    const ciFix = stub('ci-fix', ['check.completed']);
    const result = await run(event({ depth: MAX_EVENT_DEPTH }), [ciFix]);

    expect(ciFix.calls).toHaveLength(1);
    expect(result.responsibility).toBe('ci-fix');
  });

  it('refuses an event past the maximum depth without calling any responsibility', async () => {
    const ciFix = stub('ci-fix', ['check.completed']);
    const ev = event({
      depth: MAX_EVENT_DEPTH + 1,
      caused_by: { kind: 'task', id: 'task-ci-fix-1' },
    });

    const result = await run(ev, [ciFix]);

    expect(result.outcome).toBe('skipped');
    expect(result.responsibility).toBeNull();
    expect(result.task_id).toBe(ev.id);
    expect(result.summary).toBe(
      `Refused: event depth ${MAX_EVENT_DEPTH + 1} exceeds the maximum of ${MAX_EVENT_DEPTH}`,
    );
    expect(result.why).toContain('depth');
    expect(ciFix.calls).toHaveLength(0);
  });

  it('turns a throwing responsibility into an error without the thrown message', async () => {
    const ciFix = stub('ci-fix', ['check.completed'], () => {
      throw new Error('token=abc123');
    });
    const ev = event();

    const lines: string[] = [];

    const result = await run(ev, [ciFix], bothConfigured, (line) => lines.push(line));

    expect(result.outcome).toBe('error');
    expect(result.responsibility).toBe('ci-fix');
    expect(result.task_id).toBe(ev.id);
    expect(result.repo).toBe(ev.repo);
    expect(result.decision_needed).toBe('Check the run logs, then rerun or take over.');
    expect(JSON.stringify(result)).not.toContain('abc123');
    expect(lines).toEqual(['ci-fix threw Error']);
  });

  it('logs the contract issue paths for an invalid outcome without values', async () => {
    const ciFix = stub('ci-fix', ['check.completed'], (ctx) => {
      const bad: Doc = { ...outcomeFor('ci-fix', ctx.event), summary: 'secret-summary-xyz' };
      delete bad['cost'];
      return bad;
    });
    const lines: string[] = [];

    await run(event(), [ciFix], bothConfigured, (line) => lines.push(line));

    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('ci-fix returned an invalid outcome: ');
    expect(lines[0]).toContain('cost');
    expect(lines[0]).not.toContain('secret-summary-xyz');
  });

  it('logs when an outcome names another responsibility', async () => {
    const ciFix = stub('ci-fix', ['check.completed'], (ctx) =>
      outcomeFor('dep-updates', ctx.event),
    );
    const lines: string[] = [];

    await run(event(), [ciFix], bothConfigured, (line) => lines.push(line));

    expect(lines).toEqual(['ci-fix returned an outcome for another responsibility or repo']);
  });

  it('turns an invalid outcome into an error', async () => {
    const ciFix = stub('ci-fix', ['check.completed'], (ctx) => {
      const bad: Doc = { ...outcomeFor('ci-fix', ctx.event), summary: 'secret-summary-xyz' };
      delete bad['cost'];
      return bad;
    });

    const result = await run(event(), [ciFix]);

    expect(result.outcome).toBe('error');
    expect(result.responsibility).toBe('ci-fix');
    expect(result.decision_needed).toBeDefined();
    expect(JSON.stringify(result)).not.toContain('secret-summary-xyz');
  });

  it('turns an outcome naming another responsibility into an error', async () => {
    const ciFix = stub('ci-fix', ['check.completed'], (ctx) =>
      outcomeFor('dep-updates', ctx.event),
    );

    const result = await run(event(), [ciFix]);

    expect(result.outcome).toBe('error');
    expect(result.responsibility).toBe('ci-fix');
  });

  it('turns an outcome for another repo into an error', async () => {
    const ciFix = stub('ci-fix', ['check.completed'], (ctx) => ({
      ...outcomeFor('ci-fix', ctx.event),
      repo: 'other-owner/other-repo',
    }));

    const result = await run(event(), [ciFix]);

    expect(result.outcome).toBe('error');
    expect(result.repo).toBe(baseEvent.repo);
  });

  it('does not let a responsibility mutate the caller event or config', async () => {
    const ciFix = stub('ci-fix', ['check.completed'], (ctx) => {
      ctx.event.payload['tampered'] = true;
      ctx.config.responsibilities['dep-updates'] = undefined;
      return outcomeFor('ci-fix', ctx.event);
    });

    // run() asserts the event and config are deep-equal to their pre-dispatch copies.
    const result = await run(event(), [ciFix]);
    expect(result.outcome).toBe('ready');
  });
});
