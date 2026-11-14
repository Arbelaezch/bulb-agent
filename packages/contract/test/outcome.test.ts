import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ContractValidationError, outcomeSchema, parseOutcome } from '../src/index.js';
import type { ValidationIssue } from '../src/index.js';

type Doc = Record<string, unknown>;

const load = (name: string): Doc =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')) as Doc;

const ready = load('outcome-ready.json');
const blocked = load('outcome-blocked.json');

function mutated(base: Doc, mutate: (doc: Doc) => void): Doc {
  const doc = structuredClone(base);
  mutate(doc);
  return doc;
}

function issuesOf(value: unknown): readonly ValidationIssue[] {
  try {
    parseOutcome(value);
  } catch (err) {
    expect(err).toBeInstanceOf(ContractValidationError);
    expect((err as ContractValidationError).document).toBe('outcome');
    return (err as ContractValidationError).issues;
  }
  throw new Error('expected parseOutcome to throw');
}

const linkUrlPattern = outcomeSchema.properties.links.items.properties.url.pattern;

describe('parseOutcome', () => {
  it.each([
    ['ready', ready],
    ['blocked', blocked],
  ])('accepts the %s fixture and returns an equal clone', (_name, doc) => {
    const outcome = parseOutcome(doc);
    expect(outcome).toEqual(doc);
    expect(outcome).not.toBe(doc);
  });

  it.each(['blocked', 'error'])('rejects %s without decision_needed', (kind) => {
    const doc = mutated(blocked, (d) => {
      d.outcome = kind;
      delete d.decision_needed;
    });
    expect(issuesOf(doc)).toEqual([{ path: 'decision_needed', message: 'is required' }]);
  });

  it.each(['done', 'ready', 'skipped'])('accepts %s without decision_needed', (kind) => {
    const doc = mutated(blocked, (d) => {
      d.outcome = kind;
      delete d.decision_needed;
    });
    expect(parseOutcome(doc)).toEqual(doc);
  });

  it.each<[string, Doc, ValidationIssue]>([
    [
      'unknown outcome',
      mutated(ready, (d) => (d.outcome = 'waiting')),
      {
        path: 'outcome',
        message:
          'must be equal to one of the allowed values: "done", "ready", "blocked", "error", "skipped"',
      },
    ],
    [
      'multi-line summary',
      mutated(ready, (d) => (d.summary = 'line one\nline two')),
      {
        path: 'summary',
        message: `must match pattern "${outcomeSchema.properties.summary.pattern}"`,
      },
    ],
    [
      'negative cost.cad',
      mutated(ready, (d) => ((d.cost as Doc).cad = -0.01)),
      { path: 'cost.cad', message: 'must be >= 0' },
    ],
    [
      'a link URL that is not http(s)',
      mutated(ready, (d) => (d.links = [{ kind: 'pr', url: 'ftp://example.com/x' }])),
      { path: 'links[0].url', message: `must match pattern "${linkUrlPattern}"` },
    ],
    [
      'unknown verification_signal',
      mutated(ready, (d) => (d.verification_signal = 'vibes')),
      {
        path: 'verification_signal',
        message:
          'must be equal to one of the allowed values: "ci_checks", "platform_check", "verify_commands", "none"',
      },
    ],
    [
      'missing cost',
      mutated(ready, (d) => delete d.cost),
      { path: 'cost', message: 'is required' },
    ],
  ])('rejects %s', (_name, doc, issue) => {
    expect(issuesOf(doc)).toContainEqual(issue);
  });
});
