import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: ['**/dist/**', '**/node_modules/**', 'coverage/**', '.harness/**', '.factory/**'],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
);
