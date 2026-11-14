import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ContractValidationError, parseWakeEvent, wakeEventSchema } from '../src/index.js';
import type { ValidationIssue } from '../src/index.js';

type Doc = Record<string, unknown>;

const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/wake-event.json', import.meta.url), 'utf8'),
) as Doc;

function mutated(mutate: (doc: Doc) => void): Doc {
  const doc = structuredClone(fixture);
  mutate(doc);
  return doc;
}

function issuesOf(value: unknown): readonly ValidationIssue[] {
  try {
    parseWakeEvent(value);
  } catch (err) {
    expect(err).toBeInstanceOf(ContractValidationError);
    expect((err as ContractValidationError).document).toBe('wake event');
    return (err as ContractValidationError).issues;
  }
  throw new Error('expected parseWakeEvent to throw');
}

describe('parseWakeEvent', () => {
  it('accepts the fixture and returns an equal clone', () => {
    const event = parseWakeEvent(fixture);
    expect(event).toEqual(fixture);
    expect(event).not.toBe(fixture);
  });

  it.each([
    [
      'a root event at depth 0 without caused_by',
      mutated((d) => {
        d.depth = 0;
        delete d.caused_by;
      }),
    ],
    ['an empty payload', mutated((d) => (d.payload = {}))],
  ])('accepts %s', (_name, doc) => {
    expect(parseWakeEvent(doc)).toEqual(doc);
  });

  it.each<[string, Doc, ValidationIssue]>([
    [
      'unknown source',
      mutated((d) => (d.source = 'gitlab')),
      {
        path: 'source',
        message:
          'must be equal to one of the allowed values: "github", "schedule", "dashboard", "bulb"',
      },
    ],
    [
      'type without a dot',
      mutated((d) => (d.type = 'opened')),
      { path: 'type', message: `must match pattern "${wakeEventSchema.properties.type.pattern}"` },
    ],
    [
      'repo not owner/name',
      mutated((d) => (d.repo = 'just-a-name')),
      { path: 'repo', message: `must match pattern "${wakeEventSchema.properties.repo.pattern}"` },
    ],
    ['negative depth', mutated((d) => (d.depth = -1)), { path: 'depth', message: 'must be >= 0' }],
    [
      'depth 1 without caused_by',
      mutated((d) => {
        d.depth = 1;
        delete d.caused_by;
      }),
      { path: 'caused_by', message: 'is required' },
    ],
    ['an unknown key', mutated((d) => (d.extra = true)), { path: 'extra', message: 'unknown key' }],
    [
      'missing payload',
      mutated((d) => delete d.payload),
      { path: 'payload', message: 'is required' },
    ],
  ])('rejects %s', (_name, doc, issue) => {
    expect(issuesOf(doc)).toContainEqual(issue);
  });

  it('reports only the missing caused_by when depth >= 1', () => {
    const doc = mutated((d) => {
      d.depth = 3;
      delete d.caused_by;
    });
    expect(issuesOf(doc)).toEqual([{ path: 'caused_by', message: 'is required' }]);
  });
});
