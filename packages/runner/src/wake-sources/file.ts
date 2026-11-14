import { readFile } from 'node:fs/promises';
import type { WakeSource } from '../adapters.js';

/** An input problem whose message is safe to print: it never contains file contents or input values. */
export class RunnerInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RunnerInputError';
  }
}

/** Reads one wake event (a JSON object) from a file. The runner validates it afterwards. */
export class FileWakeSource implements WakeSource {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  async readEvent(): Promise<unknown> {
    let text: string;
    try {
      text = await readFile(this.#filePath, 'utf8');
    } catch (err) {
      throw new RunnerInputError(`${this.#filePath}: cannot read file (${errorCode(err)})`);
    }
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new RunnerInputError(`${this.#filePath}: not valid JSON`);
    }
  }
}

export function errorCode(err: unknown): string {
  const code = (err as NodeJS.ErrnoException | null)?.code;
  return typeof code === 'string' ? code : 'unknown';
}
