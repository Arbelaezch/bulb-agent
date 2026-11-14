# runner

The Bulb runner: reads one wake event, routes it to the configured responsibility that handles it and reports one
outcome.

## Usage

```sh
bulb run --event <file>
```

- Event file: JSON, one wake event object (validated against the contract's wake event schema).
- Config: `.bulb/config.yaml`, resolved against the working directory (there is no `--config` flag yet).
- Stdout: the outcome as one line of JSON followed by a newline, and nothing else. Diagnostics go to stderr and never
  echo input values.

No real responsibilities exist yet, so today every valid event under the depth cap ends as a `skipped` outcome.

## Exit codes

- `0`: an outcome was emitted and it is `done`, `ready` or `skipped`.
- `1`: an outcome was emitted and it is `blocked` or `error` (also an unexpected crash).
- `2`: no outcome, the input was bad (usage error, unreadable or non-JSON event file, invalid wake event, missing or
  invalid config).

The constants are exported as `EXIT_OK`, `EXIT_OUTCOME_FAILED` and `EXIT_INVALID_INPUT`.

## Loop guard

`MAX_EVENT_DEPTH = 3`. An event with `depth > 3` is refused as a `skipped` outcome (not `blocked`, so the owner is
not notified for every refused event). Events no configured and enabled responsibility handles are also `skipped`.
Both runner-level outcomes have `responsibility: null`, `task_id` equal to the event id and zero cost.

## Contract import

The runner imports the contract through a relative path (`src/contract.ts`) because the npm scope is unconfirmed;
switch to `<contract package>` once it is confirmed. Build the contract first (`npm run build` from the repo root).
