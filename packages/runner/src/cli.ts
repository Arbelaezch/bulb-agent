import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import type { StateStore } from './adapters.js';
import {
  BulbConfigError,
  ContractValidationError,
  parseWakeEvent,
  readBulbConfigFile,
} from './contract.js';
import type { BulbConfig, WakeEvent } from './contract.js';
import { dispatch } from './dispatch.js';
import { StdoutReporter } from './reporters/stdout.js';
import { createRegistry } from './responsibility.js';
import type { ResponsibilityRegistry } from './responsibility.js';
import { InMemoryStateStore } from './testing/index.js';
import { FileWakeSource, RunnerInputError, errorCode } from './wake-sources/file.js';

/** An outcome was emitted and it is `done`, `ready` or `skipped`. */
export const EXIT_OK = 0;
/** An outcome was emitted and it is `blocked` or `error`. */
export const EXIT_OUTCOME_FAILED = 1;
/** No outcome: the input was bad (usage, event file, wake event or config). */
export const EXIT_INVALID_INPUT = 2;

export const CONFIG_PATH = '.bulb/config.yaml';
const USAGE = 'Usage: bulb run --event <file>';

export interface CliIo {
  cwd: string;
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  registry?: ResponsibilityRegistry;
  stateStore?: StateStore;
}

/**
 * Runs `bulb run --event <file>`: reads and validates the event and the config, dispatches it and reports exactly
 * one outcome on stdout. Everything else goes to stderr. Messages never echo input values.
 */
export async function runCli(argv: readonly string[], io: CliIo): Promise<number> {
  const fail = (message: string): number => {
    io.stderr(`${message}\n`);
    return EXIT_INVALID_INPUT;
  };
  const usage = (reason: string): number => fail(`${USAGE}\n${reason}`);

  let eventArg: string | undefined;
  try {
    const { values, positionals } = parseArgs({
      args: [...argv],
      strict: true,
      allowPositionals: true,
      options: { event: { type: 'string' } },
    });
    if (positionals.length !== 1 || positionals[0] !== 'run') {
      return usage('Expected the single command "run".');
    }
    eventArg = values.event;
  } catch {
    return usage('Unrecognised or malformed arguments.');
  }
  if (eventArg === undefined) return usage('Missing --event <file>.');

  const eventPath = resolve(io.cwd, eventArg);
  let event: WakeEvent;
  try {
    event = parseWakeEvent(await new FileWakeSource(eventPath).readEvent());
  } catch (err) {
    if (err instanceof RunnerInputError) return fail(err.message);
    if (err instanceof ContractValidationError) return fail(`${eventPath}: ${err.message}`);
    throw err;
  }

  const configPath = resolve(io.cwd, CONFIG_PATH);
  let config: BulbConfig;
  try {
    config = await readBulbConfigFile(configPath);
  } catch (err) {
    if (err instanceof BulbConfigError) return fail(err.message);
    return fail(`${configPath}: cannot read file (${errorCode(err)})`);
  }

  // No real responsibilities or persistent state store exist yet; later issues replace both defaults.
  const outcome = await dispatch(event, {
    registry: io.registry ?? createRegistry([]),
    config,
    stateStore: io.stateStore ?? new InMemoryStateStore(),
    log: (line) => io.stderr(`${line}\n`),
  });
  await new StdoutReporter(io.stdout).report(outcome);
  return outcome.outcome === 'blocked' || outcome.outcome === 'error'
    ? EXIT_OUTCOME_FAILED
    : EXIT_OK;
}
