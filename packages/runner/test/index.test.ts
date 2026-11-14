import { describe, expect, it } from 'vitest';
import * as runner from '../src/index.js';

describe('runner entry', () => {
  it('exports the runner core', () => {
    expect(typeof runner.dispatch).toBe('function');
    expect(typeof runner.createRegistry).toBe('function');
    expect(typeof runner.outcomeToWakeEvent).toBe('function');
    expect(typeof runner.StdoutReporter).toBe('function');
    expect(runner.MAX_EVENT_DEPTH).toBe(3);
  });

  it('refuses only depths past the maximum', () => {
    expect(runner.exceedsMaxDepth(runner.MAX_EVENT_DEPTH)).toBe(false);
    expect(runner.exceedsMaxDepth(runner.MAX_EVENT_DEPTH + 1)).toBe(true);
  });
});
