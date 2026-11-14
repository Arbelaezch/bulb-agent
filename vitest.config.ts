import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['{packages,adapters,responsibilities}/*/{src,test}/**/*.test.ts'],
  },
});
