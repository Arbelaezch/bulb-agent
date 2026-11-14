import { describe, expect, it } from 'vitest';
import { ContractValidationError } from '../src/index.js';
import { createParser } from '../src/validation/validate.js';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  additionalProperties: false,
  required: ['kind'],
  properties: {
    kind: { enum: ['a', 'b'] },
    x: { type: 'string' },
    note: { type: 'string' },
  },
  if: { required: ['kind'], properties: { kind: { enum: ['b'] } } },
  // Strict mode (strictRequired) wants `required` names declared in the same subschema.
  then: { required: ['note'], properties: { note: { type: 'string' } } },
};

const parse = createParser<{ kind: string; x?: string; note?: string }>(schema, 'test doc');

function failure(value: unknown): ContractValidationError {
  try {
    parse(value);
  } catch (err) {
    expect(err).toBeInstanceOf(ContractValidationError);
    return err as ContractValidationError;
  }
  throw new Error('expected parse to throw');
}

describe('createParser', () => {
  it('returns an equal but not identical object for a valid value', () => {
    const input = { kind: 'a', x: 'hi' };
    const output = parse(input);
    expect(output).toEqual(input);
    expect(output).not.toBe(input);
  });

  it('reports unknown keys', () => {
    expect(failure({ kind: 'a', x: 'ok', y: 1 }).issues).toEqual([
      { path: 'y', message: 'unknown key' },
    ]);
  });

  it('reports missing required keys', () => {
    expect(failure({}).issues).toEqual([{ path: 'kind', message: 'is required' }]);
  });

  it('drops the generic if error and keeps the then required error', () => {
    const err = failure({ kind: 'b' });
    expect(err.issues).toEqual([{ path: 'note', message: 'is required' }]);
    expect(err.message).not.toContain('"then"');
  });

  it('sets the document name', () => {
    const err = failure({});
    expect(err.document).toBe('test doc');
    expect(err.name).toBe('ContractValidationError');
    expect(err.message).toBe('Invalid test doc:\n  kind: is required');
  });

  it('never puts input values in the message', () => {
    const err = failure({ kind: 'a', x: 'SENTINEL-SECRET', note: 42 });
    expect(err.message).not.toContain('SENTINEL-SECRET');
    expect(failure({ kind: 'SENTINEL-SECRET' }).message).not.toContain('SENTINEL-SECRET');
  });
});
