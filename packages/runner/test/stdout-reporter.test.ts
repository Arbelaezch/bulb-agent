import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ContractValidationError, parseOutcome } from '../src/contract.js';
import type { Outcome } from '../src/contract.js';
import { StdoutReporter } from '../src/reporters/stdout.js';

const outcome = parseOutcome(
  JSON.parse(
    readFileSync(
      new URL('../../contract/test/fixtures/outcome-ready.json', import.meta.url),
      'utf8',
    ),
  ),
);

describe('StdoutReporter', () => {
  it('writes the outcome as one JSON line in a single write', async () => {
    const writes: string[] = [];
    await new StdoutReporter((text) => writes.push(text)).report(outcome);

    expect(writes).toHaveLength(1);
    const text = writes[0] ?? '';
    expect(text.endsWith('\n')).toBe(true);
    expect(text.split('\n')).toHaveLength(2);
    expect(JSON.parse(text)).toEqual(outcome);
  });

  it('rejects an invalid outcome and writes nothing', async () => {
    const writes: string[] = [];
    const invalid = { ...structuredClone(outcome), cost: undefined } as unknown as Outcome;

    await expect(
      new StdoutReporter((text) => writes.push(text)).report(invalid),
    ).rejects.toBeInstanceOf(ContractValidationError);
    expect(writes).toHaveLength(0);
  });
});
