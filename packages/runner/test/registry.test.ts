import { describe, expect, it } from 'vitest';
import { createRegistry } from '../src/responsibility.js';
import type { Responsibility, ResponsibilityName } from '../src/responsibility.js';

function stub(name: ResponsibilityName, eventTypes: string[]): Responsibility {
  return {
    name,
    eventTypes,
    run: () => Promise.reject(new Error('not called in registry tests')),
  };
}

describe('createRegistry', () => {
  it('finds the responsibility for an event type', () => {
    const ciFix = stub('ci-fix', ['check.completed']);
    const depUpdates = stub('dep-updates', ['dependabot.pr.opened', 'schedule.tick']);
    const registry = createRegistry([ciFix, depUpdates]);

    expect(registry.forEventType('check.completed')).toBe(ciFix);
    expect(registry.forEventType('schedule.tick')).toBe(depUpdates);
    expect(registry.responsibilities).toEqual([ciFix, depUpdates]);
  });

  it('returns undefined for an unknown event type', () => {
    const registry = createRegistry([stub('ci-fix', ['check.completed'])]);
    expect(registry.forEventType('security.alert')).toBeUndefined();
  });

  it('works with no responsibilities', () => {
    expect(createRegistry([]).forEventType('check.completed')).toBeUndefined();
  });

  it('throws when two responsibilities claim the same event type', () => {
    expect(() =>
      createRegistry([
        stub('ci-fix', ['check.completed']),
        stub('dep-updates', ['check.completed']),
      ]),
    ).toThrow(/check\.completed/);
  });

  it('throws when two responsibilities share a name', () => {
    expect(() =>
      createRegistry([stub('ci-fix', ['check.completed']), stub('ci-fix', ['security.alert'])]),
    ).toThrow(/Duplicate responsibility name: ci-fix/);
  });
});
