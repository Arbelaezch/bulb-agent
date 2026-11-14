import type { Reporter } from '../adapters.js';
import { parseOutcome } from '../contract.js';
import type { Outcome } from '../contract.js';

/**
 * Writes each outcome to stdout as one line of JSON followed by `\n`, and nothing else. An invalid outcome throws
 * `ContractValidationError` and writes nothing.
 */
export class StdoutReporter implements Reporter {
  readonly #write: (text: string) => void;

  constructor(
    write: (text: string) => void = (text) => {
      process.stdout.write(text);
    },
  ) {
    this.#write = write;
  }

  async report(outcome: Outcome): Promise<void> {
    const valid = parseOutcome(outcome);
    this.#write(`${JSON.stringify(valid)}\n`);
  }
}
