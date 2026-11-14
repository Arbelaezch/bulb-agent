import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ContractValidationError,
  parseResponsibilityScope,
  responsibilityScopeSchema,
} from '../src/index.js';
import type { ValidationIssue } from '../src/index.js';

type Doc = Record<string, unknown>;

const ciFix = JSON.parse(
  readFileSync(new URL('./fixtures/responsibility-scope-ci-fix.json', import.meta.url), 'utf8'),
) as Doc;

function mutated(base: Doc, mutate: (doc: Doc) => void): Doc {
  const doc = structuredClone(base);
  mutate(doc);
  return doc;
}

function issuesOf(value: unknown): readonly ValidationIssue[] {
  try {
    parseResponsibilityScope(value);
  } catch (err) {
    expect(err).toBeInstanceOf(ContractValidationError);
    expect((err as ContractValidationError).document).toBe('responsibility scope');
    return (err as ContractValidationError).issues;
  }
  throw new Error('expected parseResponsibilityScope to throw');
}

const pathPattern = responsibilityScopeSchema.properties.paths.items.pattern;

describe('parseResponsibilityScope', () => {
  it('accepts the ci-fix fixture and returns an equal clone', () => {
    const scope = parseResponsibilityScope(ciFix);
    expect(scope).toEqual(ciFix);
    expect(scope).not.toBe(ciFix);
  });

  it('accepts a dep-updates declaration without max_diff_lines', () => {
    const doc = {
      responsibility: 'dep-updates',
      paths: ['package.json', 'package-lock.json', 'requirements*.txt', 'poetry.lock'],
    };
    expect(parseResponsibilityScope(doc)).toEqual(doc);
  });

  it.each<[string, Doc, ValidationIssue]>([
    [
      'empty paths',
      mutated(ciFix, (d) => (d.paths = [])),
      { path: 'paths', message: 'must NOT have fewer than 1 items' },
    ],
    [
      'an absolute path',
      mutated(ciFix, (d) => (d.paths = ['/etc/passwd'])),
      { path: 'paths[0]', message: `must match pattern "${pathPattern}"` },
    ],
    [
      'a leading .. segment',
      mutated(ciFix, (d) => (d.paths = ['../x'])),
      { path: 'paths[0]', message: `must match pattern "${pathPattern}"` },
    ],
    [
      'an inner .. segment',
      mutated(ciFix, (d) => (d.paths = ['a/../b'])),
      { path: 'paths[0]', message: `must match pattern "${pathPattern}"` },
    ],
    [
      'a backslash path',
      mutated(ciFix, (d) => (d.paths = ['src\\x'])),
      { path: 'paths[0]', message: `must match pattern "${pathPattern}"` },
    ],
    [
      'a brace set that expands to ..',
      mutated(ciFix, (d) => (d.paths = ['{..,src}/**'])),
      { path: 'paths[0]', message: `must match pattern "${pathPattern}"` },
    ],
    [
      'an empty brace set after ..',
      mutated(ciFix, (d) => (d.paths = ['..{,}/x'])),
      { path: 'paths[0]', message: `must match pattern "${pathPattern}"` },
    ],
    [
      'an extglob that matches ..',
      mutated(ciFix, (d) => (d.paths = ['@(..)/x'])),
      { path: 'paths[0]', message: `must match pattern "${pathPattern}"` },
    ],
    [
      'max_diff_lines 0',
      mutated(ciFix, (d) => (d.max_diff_lines = 0)),
      { path: 'max_diff_lines', message: 'must be >= 1' },
    ],
    [
      'unknown responsibility',
      mutated(ciFix, (d) => (d.responsibility = 'lint-fix')),
      {
        path: 'responsibility',
        message:
          'must be equal to one of the allowed values: "dep-updates", "vuln-patch", "ci-fix"',
      },
    ],
    [
      'an unknown key',
      mutated(ciFix, (d) => (d.never_touch = ['.env'])),
      { path: 'never_touch', message: 'unknown key' },
    ],
  ])('rejects %s', (_name, doc, issue) => {
    expect(issuesOf(doc)).toContainEqual(issue);
  });

  it('rejects duplicate paths', () => {
    const doc = mutated(ciFix, (d) => (d.paths = ['src/**', 'src/**']));
    expect(issuesOf(doc)).toContainEqual({
      path: 'paths',
      message: expect.stringMatching(/^must NOT have duplicate items/) as unknown as string,
    });
  });

  it('accepts names that only contain dots', () => {
    const doc = mutated(ciFix, (d) => (d.paths = ['.npmrc', 'a..b/c', '...']));
    expect(parseResponsibilityScope(doc)).toEqual(doc);
  });
});
