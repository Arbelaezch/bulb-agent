import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ContractValidationError,
  TASK_STATE_MAX_BYTES,
  assertTaskStateSize,
  parseTaskState,
  taskStateByteLength,
  taskStateSchema,
} from '../src/index.js';
import type { ValidationIssue } from '../src/index.js';

type Doc = Record<string, unknown>;

const waiting = JSON.parse(
  readFileSync(new URL('./fixtures/task-state-waiting.json', import.meta.url), 'utf8'),
) as Doc;

function mutated(base: Doc, mutate: (doc: Doc) => void): Doc {
  const doc = structuredClone(base);
  mutate(doc);
  return doc;
}

function issuesOf(value: unknown): readonly ValidationIssue[] {
  try {
    parseTaskState(value);
  } catch (err) {
    expect(err).toBeInstanceOf(ContractValidationError);
    expect((err as ContractValidationError).document).toBe('task state');
    return (err as ContractValidationError).issues;
  }
  throw new Error('expected parseTaskState to throw');
}

describe('parseTaskState', () => {
  it('accepts the waiting fixture and returns an equal clone', () => {
    const state = parseTaskState(waiting);
    expect(state).toEqual(waiting);
    expect(state).not.toBe(waiting);
  });

  it('rejects waiting without deadline with only the deadline issue', () => {
    const doc = mutated(waiting, (d) => delete d.deadline);
    expect(issuesOf(doc)).toEqual([{ path: 'deadline', message: 'is required' }]);
  });

  it('accepts running without deadline', () => {
    const doc = mutated(waiting, (d) => {
      d.phase = 'running';
      delete d.deadline;
    });
    expect(parseTaskState(doc)).toEqual(doc);
  });

  it.each(['log', 'logs', 'transcript', 'transcripts', 'messages'])('rejects a %s key', (key) => {
    const doc = mutated(waiting, (d) => (d[key] = ['something']));
    expect(issuesOf(doc)).toContainEqual({ path: key, message: 'unknown key' });
  });

  it('has no schema property for logs or transcripts', () => {
    expect(
      Object.keys(taskStateSchema.properties).filter((k) => /log|transcript/i.test(k)),
    ).toEqual([]);
  });

  it.each<[string, Doc, ValidationIssue]>([
    [
      'version 2',
      mutated(waiting, (d) => (d.version = 2)),
      { path: 'version', message: 'must be equal to one of the allowed values: 1' },
    ],
    [
      'negative attempts',
      mutated(waiting, (d) => (d.attempts = -1)),
      { path: 'attempts', message: 'must be >= 0' },
    ],
    [
      'unknown phase',
      mutated(waiting, (d) => (d.phase = 'sleeping')),
      {
        path: 'phase',
        message:
          'must be equal to one of the allowed values: "running", "waiting", "done", "ready", "blocked", "error", "skipped"',
      },
    ],
    [
      'a malformed deadline',
      mutated(waiting, (d) => (d.deadline = '2026-11-13 18:30')),
      {
        path: 'deadline',
        message: `must match pattern "${taskStateSchema.properties.deadline.pattern}"`,
      },
    ],
    [
      'an invalid caused_by.kind',
      mutated(waiting, (d) => ((d.caused_by as Doc).kind = 'schedule')),
      {
        path: 'caused_by.kind',
        message: 'must be equal to one of the allowed values: "event", "task"',
      },
    ],
  ])('rejects %s', (_name, doc, issue) => {
    expect(issuesOf(doc)).toContainEqual(issue);
  });
});

describe('task state size', () => {
  // `{"pad":"<n chars>"}` serialises to n + 10 characters.
  const padded = (n: number, char = 'x') => ({ pad: char.repeat(n) });

  it('uses a 10,240-byte limit', () => {
    expect(TASK_STATE_MAX_BYTES).toBe(10_240);
  });

  it('accepts a document of exactly 10,240 bytes', () => {
    const doc = padded(10_230);
    expect(taskStateByteLength(doc)).toBe(10_240);
    expect(() => assertTaskStateSize(doc)).not.toThrow();
  });

  it('rejects a document of 10,241 bytes with a RangeError', () => {
    const doc = padded(10_231);
    expect(taskStateByteLength(doc)).toBe(10_241);
    expect(() => assertTaskStateSize(doc)).toThrow(RangeError);
    expect(() => assertTaskStateSize(doc)).toThrow(
      'Task state is 10241 bytes serialised; the limit is 10240 bytes',
    );
  });

  it('counts UTF-8 bytes, not string length', () => {
    const doc = padded(6_000, 'é');
    expect(JSON.stringify(doc).length).toBeLessThan(TASK_STATE_MAX_BYTES);
    expect(taskStateByteLength(doc)).toBe(12_010);
    expect(() => assertTaskStateSize(doc)).toThrow(RangeError);
  });

  it('never includes state content in the error message', () => {
    const doc = { pad: 'x'.repeat(10_240), secret: 'SENTINEL-VALUE' };
    let message = '';
    try {
      assertTaskStateSize(doc);
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toMatch(/^Task state is \d+ bytes serialised/);
    expect(message).not.toContain('SENTINEL-VALUE');
  });

  it('measures the fixture like Buffer.byteLength of compact JSON', () => {
    expect(taskStateByteLength(waiting)).toBe(Buffer.byteLength(JSON.stringify(waiting)));
    expect(() => assertTaskStateSize(waiting)).not.toThrow();
  });
});
