import { describe, expect, it } from 'vitest';
import { PACKAGE_STATUS } from '../src/index.js';

describe('runner scaffold', () => {
  it('reports scaffold status', () => {
    expect(PACKAGE_STATUS).toBe('scaffold');
  });
});
