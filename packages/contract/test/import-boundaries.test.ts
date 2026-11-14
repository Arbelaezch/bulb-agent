import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const contractDir = join(root, 'packages/contract');

function workspaceDirs(): string[] {
  const dirs = [root];
  for (const group of ['packages', 'adapters', 'responsibilities']) {
    const base = join(root, group);
    if (!existsSync(base)) continue;
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      if (entry.isDirectory()) dirs.push(join(base, entry.name));
    }
  }
  return dirs.filter((dir) => existsSync(join(dir, 'package.json')));
}

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(path));
    else if (/\.(ts|js)$/.test(entry.name)) files.push(path);
  }
  return files;
}

function specifiers(text: string): string[] {
  const found: string[] = [];
  const pattern = /(?:from\s*|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g;
  for (const match of text.matchAll(pattern)) found.push(match[1] as string);
  return found;
}

describe('import boundaries', () => {
  it('no workspace depends on the dashboard', () => {
    const offenders: string[] = [];
    for (const dir of workspaceDirs()) {
      const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as Record<
        string,
        Record<string, string> | undefined
      >;
      for (const field of [
        'dependencies',
        'devDependencies',
        'peerDependencies',
        'optionalDependencies',
      ]) {
        for (const name of Object.keys(pkg[field] ?? {})) {
          if (/dashboard/i.test(name)) offenders.push(`${dir}: ${name}`);
        }
      }
      for (const sub of ['src', 'test', 'scripts']) {
        for (const file of sourceFiles(join(dir, sub))) {
          for (const spec of specifiers(readFileSync(file, 'utf8'))) {
            if (spec.startsWith('.') || spec.startsWith('node:')) continue;
            if (/dashboard/i.test(spec)) offenders.push(`${file}: ${spec}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('keeps node:http out of the main entry', () => {
    const testingDir = join(contractDir, 'src/testing');
    const offenders = sourceFiles(join(contractDir, 'src'))
      .filter((file) => !file.startsWith(testingDir))
      .filter((file) =>
        specifiers(readFileSync(file, 'utf8')).some((spec) =>
          ['node:http', 'node:https', 'node:net'].includes(spec),
        ),
      );
    expect(offenders).toEqual([]);
    const index = readFileSync(join(contractDir, 'src/index.ts'), 'utf8');
    expect(specifiers(index).some((spec) => spec.includes('/testing'))).toBe(false);
    expect(index).not.toContain('./testing');
  });

  it('declares the ./testing subpath export', () => {
    const pkg = JSON.parse(readFileSync(join(contractDir, 'package.json'), 'utf8')) as {
      exports: Record<string, unknown>;
    };
    expect(pkg.exports['./testing']).toEqual({
      types: './dist/testing/index.d.ts',
      default: './dist/testing/index.js',
    });
  });
});
