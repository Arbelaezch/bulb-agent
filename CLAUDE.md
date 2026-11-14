# bulb-agent

## What this is
Open-source core of Bulb: dormant caretaker agents that wake on an event or schedule (Dependabot PR, security
alert, failed check, weekly tick), do small upkeep work on a repo end to end, and report `ready`, `blocked` or
`error` to the owner. The repo is **public** (Apache-2.0); never commit secrets, private repo details or tokens.

Status: design. Read [`docs/vision.md`](docs/vision.md) for the terms (bulb, responsibility, wake event, task,
outcome, adapter) and [`docs/mvp.md`](docs/mvp.md) for scope. [`docs/dashboard-mvp.md`](docs/dashboard-mvp.md)
belongs to the private paid dashboard; this repo must never depend on it.

## Repos
- `.` (app): planned TypeScript monorepo, Node 24 (see `docs/mvp.md` §11):
  `contract` (JSON Schema + generated TS types, published to npm), `runner` (CLI `bulb run --event <file>`),
  `adapters/*`, `responsibilities/*` (`dep-updates`, `vuln-patch`, `ci-fix`), and the GitHub Action.

## Commands
<!-- No code yet. Add install/build/test/lint commands here (and gates in .claude/harness.toml) once the
     monorepo is scaffolded. -->

## Conventions and rules
- The contract (JSON Schema) is the source of truth; TS types are generated from it, never hand-edited.
- Policy, scope and budget limits are enforced by the runner in code; never rely on the model to stay in bounds.
- Safe defaults: auto-merge off, never touch secrets or `never_touch` paths, never push to the default branch.
- Secrets are never printed, logged, passed to the model, or committed.
- Bulbs use the target repo's existing CI; they never create or change CI or workflow files.
- Everything around the contract is an adapter (host, wake source, engine, change channel, reporter, state
  store); keep provider-specific code (e.g. Claude) behind the engine interface.
- Unit tests for policy/budget enforcement and every adapter; fixture repos (npm, pip) per responsibility.
