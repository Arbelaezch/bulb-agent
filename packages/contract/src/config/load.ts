import { readFile } from 'node:fs/promises';
import { Ajv2020 } from 'ajv/dist/2020.js';
import type { ValidateFunction } from 'ajv/dist/2020.js';
import { parse, YAMLParseError } from 'yaml';
import { formatIssues, toIssues } from '../validation/issues.js';
import type { ValidationIssue } from '../validation/issues.js';
import bulbConfigSchema from '../schemas/bulb-config.schema.json' with { type: 'json' };
import type { BulbConfig } from '../generated/bulb-config.js';

export { bulbConfigSchema };

export type BulbConfigIssue = ValidationIssue;

function formatMessage(issues: readonly BulbConfigIssue[]): string {
  return formatIssues('Invalid bulb config', issues);
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

/** Validates a parsed config value, fills defaults and returns the resolved config. Does not mutate `value`. */
export function parseBulbConfig(value: unknown): BulbConfig {
  const clone = structuredClone(value);
  const validate = getValidator();
  if (!validate(clone)) {
    throw new BulbConfigError(toIssues(validate.errors));
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
