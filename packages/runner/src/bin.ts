#!/usr/bin/env node
import { runCli } from './cli.js';

try {
  process.exitCode = await runCli(process.argv.slice(2), {
    cwd: process.cwd(),
    stdout: (text) => {
      process.stdout.write(text);
    },
    stderr: (text) => {
      process.stderr.write(text);
    },
  });
} catch (err) {
  // Name only: the message could carry input values.
  process.stderr.write(`bulb: unexpected error (${err instanceof Error ? err.name : 'unknown'})\n`);
  process.exitCode = 1;
}
