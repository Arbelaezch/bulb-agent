import type { ErrorObject } from 'ajv/dist/2020.js';

export interface ValidationIssue {
  /** Dot path to the offending key, e.g. `notify.on[3]`; `""` for the root. */
  path: string;
  message: string;
}

function toDotPath(pointer: string): string {
  let path = '';
  for (const raw of pointer.split('/').slice(1)) {
    const segment = raw.replaceAll('~1', '/').replaceAll('~0', '~');
    if (/^[0-9]+$/.test(segment)) path += `[${segment}]`;
    else path += path === '' ? segment : `.${segment}`;
  }
  return path;
}

function join(path: string, key: string): string {
  return path === '' ? key : `${path}.${key}`;
}

function toIssue(error: ErrorObject): ValidationIssue {
  const path = toDotPath(error.instancePath);
  const params = error.params as Record<string, unknown>;
  if (error.keyword === 'additionalProperties') {
    return { path: join(path, String(params.additionalProperty)), message: 'unknown key' };
  }
  if (error.keyword === 'required') {
    return { path: join(path, String(params.missingProperty)), message: 'is required' };
  }
  if (error.keyword === 'enum' && Array.isArray(params.allowedValues)) {
    // Allowed values come from the schema, not the input, so they are safe to show.
    const allowed = params.allowedValues.map((v) => JSON.stringify(v)).join(', ');
    return {
      path,
      message: `${error.message ?? 'must be equal to one of the allowed values'}: ${allowed}`,
    };
  }
  return { path, message: error.message ?? 'is invalid' };
}

function dedupe(issues: ValidationIssue[]): ValidationIssue[] {
  const seen = new Set<string>();
  return issues.filter((i) => {
    const key = `${i.path}\u0000${i.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Maps Ajv errors to issues, dropping the generic `if` keyword error and duplicates. */
export function toIssues(errors: readonly ErrorObject[] | null | undefined): ValidationIssue[] {
  return dedupe((errors ?? []).filter((e) => e.keyword !== 'if').map(toIssue));
}

export function formatIssues(heading: string, issues: readonly ValidationIssue[]): string {
  return `${heading}:${issues.map((i) => `\n  ${i.path === '' ? '(root)' : i.path}: ${i.message}`).join('')}`;
}
