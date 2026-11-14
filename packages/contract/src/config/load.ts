import { readFile } from 'node:fs/promises';
import { Ajv2020 } from 'ajv/dist/2020.js';
import type { ErrorObject, ValidateFunction } from 'ajv/dist/2020.js';
import { parse, YAMLParseError } from 'yaml';
import bulbConfigSchema from '../schemas/bulb-config.schema.json' with { type: 'json' };
import type { BulbConfig } from '../generated/bulb-config.js';

export { bulbConfigSchema };

export interface BulbConfigIssue {
  /** Dot path to the offending key, e.g. `notify.on[3]`; `""` for the root. */
  path: string;
  message: string;
}

function formatMessage(issues: readonly BulbConfigIssue[]): string {
  return `Invalid bulb config:${issues.map((i) => `\n  ${i.path === '' ? '(root)' : i.path}: ${i.message}`).join('')}`;
}

export class BulbConfigError extends Error {
  readonly issues: readonly BulbConfigIssue[];

  constructor(issues: readonly BulbConfigIssue[], messagePrefix = '') {
    super(`${messagePrefix}${formatMessage(issues)}`);
    this.name = 'BulbConfigError';
    this.issues = issues;
  }
}

let cachedValidator: ValidateFunction | undefined;

function getValidator(): ValidateFunction {
  cachedValidator ??= new Ajv2020({ allErrors: true, useDefaults: true, strict: true }).compile(
    bulbConfigSchema,
  );
  return cachedValidator;
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

function toIssue(error: ErrorObject): BulbConfigIssue {
  const path = toDotPath(error.instancePath);
  const params = error.params as Record<string, unknown>;
  if (error.keyword === 'additionalProperties') {
    return { path: join(path, String(params.additionalProperty)), message: 'unknown key' };
  }
  if (error.keyword === 'required') {
    return { path: join(path, String(params.missingProperty)), message: 'is required' };
  }
  if (error.keyword === 'enum' && Array.isArray(params.allowedValues)) {
    // Allowed values come from the schema, not the config, so they are safe to show.
    const allowed = params.allowedValues.map((v) => JSON.stringify(v)).join(', ');
    return {
      path,
      message: `${error.message ?? 'must be equal to one of the allowed values'}: ${allowed}`,
    };
  }
  return { path, message: error.message ?? 'is invalid' };
}

function dedupe(issues: BulbConfigIssue[]): BulbConfigIssue[] {
  const seen = new Set<string>();
  return issues.filter((i) => {
    const key = `${i.path}\u0000${i.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Validates a parsed config value, fills defaults and returns the resolved config. Does not mutate `value`. */
export function parseBulbConfig(value: unknown): BulbConfig {
  const clone = structuredClone(value);
  const validate = getValidator();
  if (!validate(clone)) {
    throw new BulbConfigError(dedupe((validate.errors ?? []).map(toIssue)));
  }
  // Ajv has filled every default in place, so the resolved type holds.
  return clone as BulbConfig;
}

/** Parses YAML text and validates it as a bulb config. */
export function loadBulbConfig(yamlText: string): BulbConfig {
  let value: unknown;
  try {
    value = parse(yamlText, { prettyErrors: false });
  } catch (err) {
    if (err instanceof YAMLParseError) {
      // linePos is only set when prettyErrors is on, so derive it from the offset (no source snippet is kept).
      const offset = err.pos?.[0];
      let where = '';
      if (offset !== undefined) {
        const before = yamlText.slice(0, offset).split('\n');
        where = ` at line ${before.length}, column ${(before.at(-1)?.length ?? 0) + 1}`;
      }
      throw new BulbConfigError([{ path: '', message: `YAML syntax error${where} (${err.code})` }]);
    }
    throw err;
  }
  if (value === null || value === undefined) {
    throw new BulbConfigError([{ path: '', message: 'config is empty' }]);
  }
  return parseBulbConfig(value);
}

/** Reads and validates a bulb config file; errors are prefixed with the file path. */
export async function readBulbConfigFile(filePath: string): Promise<BulbConfig> {
  const text = await readFile(filePath, 'utf8');
  try {
    return loadBulbConfig(text);
  } catch (err) {
    if (err instanceof BulbConfigError) throw new BulbConfigError(err.issues, `${filePath}: `);
    throw err;
  }
}
