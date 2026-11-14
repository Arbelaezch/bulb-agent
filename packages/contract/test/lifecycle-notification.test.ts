import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ContractValidationError, parseLifecycleNotification } from '../src/index.js';
import type { ValidationIssue } from '../src/index.js';

type Doc = Record<string, unknown>;

const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/lifecycle-notification.json', import.meta.url), 'utf8'),
) as Doc;

function mutated(mutate: (doc: Doc) => void): Doc {
  const doc = structuredClone(fixture);
  mutate(doc);
  return doc;
}

function issuesOf(value: unknown): readonly ValidationIssue[] {
  try {
    parseLifecycleNotification(value);
  } catch (err) {
    expect(err).toBeInstanceOf(ContractValidationError);
    expect((err as ContractValidationError).document).toBe('lifecycle notification');
    return (err as ContractValidationError).issues;
  }
  throw new Error('expected parseLifecycleNotification to throw');
}

describe('parseLifecycleNotification', () => {
  it('accepts a started notification and returns an equal clone', () => {
    const notification = parseLifecycleNotification(fixture);
    expect(notification).toEqual(fixture);
    expect(notification).not.toBe(fixture);
  });

  it.each<[string, Doc, ValidationIssue]>([
    [
      'an outcome as notification',
      mutated((d) => (d.notification = 'ready')),
      { path: 'notification', message: 'must be equal to one of the allowed values: "started"' },
    ],
    [
      'missing task_id',
      mutated((d) => delete d.task_id),
      { path: 'task_id', message: 'is required' },
    ],
    ['an unknown key', mutated((d) => (d.extra = 1)), { path: 'extra', message: 'unknown key' }],
  ])('rejects %s', (_name, doc, issue) => {
    expect(issuesOf(doc)).toContainEqual(issue);
  });
});
