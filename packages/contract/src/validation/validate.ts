import { Ajv2020 } from 'ajv/dist/2020.js';
import type { ValidateFunction } from 'ajv/dist/2020.js';
import { formatIssues, toIssues } from './issues.js';
import type { ValidationIssue } from './issues.js';

export class ContractValidationError extends Error {
  readonly document: string;
  readonly issues: readonly ValidationIssue[];

  constructor(document: string, issues: readonly ValidationIssue[]) {
    super(formatIssues(`Invalid ${document}`, issues));
    this.name = 'ContractValidationError';
    this.document = document;
    this.issues = issues;
  }
}

const ajv = new Ajv2020({ allErrors: true, strict: true });

/** Builds a validator for `schema`; the result is a clone of the input, or a thrown `ContractValidationError`. */
export function createParser<T>(schema: object, document: string): (value: unknown) => T {
  let validate: ValidateFunction | undefined;
  return (value: unknown): T => {
    validate ??= ajv.compile(schema);
    const clone = structuredClone(value);
    if (!validate(clone)) {
      throw new ContractValidationError(document, toIssues(validate.errors));
    }
    return clone as T;
  };
}
