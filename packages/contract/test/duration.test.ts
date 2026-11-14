import { describe, expect, it } from 'vitest';
import { parseDurationMs } from '../src/config/duration.js';

describe('parseDurationMs', () => {
  it.each([
    ['0d', 0],
    ['0m', 0],
    ['30m', 1_800_000],
    ['2h', 7_200_000],
    ['7d', 604_800_000],
  ])('parses %s', (input, ms) => {
    expect(parseDurationMs(input)).toBe(ms);
  });

  it.each(['', '7', 'd', '1w', '-1d', '1.5h', '01d', ' 2h', '2h ', '2H'])('rejects %j', (input) => {
    expect(() => parseDurationMs(input)).toThrow(RangeError);
    expect(() => parseDurationMs(input)).toThrow(/<integer><unit>/);
  });
});
