# Decisions

Questions about the product or its implementation and how they were settled. Recorded by the factory; `question-resolver` and the planners treat these as source documents.

## Does allow [patch, minor] drop majors entirely or do majors still get their own PR?
- Kind: product
- Decision: Majors get their own PR, one per package, never auto-merged; allow only governs the grouped PR and auto-merge.
- Decided by: user on 2026-11-14
- Why: resolves contradiction mvp.md:71 vs 118-120
- Source: docs/mvp.md:71,118-120

## Vision says state lives in the dashboard but core must work without it; which wins?
- Kind: product
- Decision: Core works alone; the dashboard is an optional state store and reporter. vision.md should be updated to say so.
- Decided by: user on 2026-11-14
- Why: resolves contradiction vision.md:48-50 vs mvp.md:35
- Source: docs/vision.md:48-50,95; docs/mvp.md:35,142

## Setup path installs a workflow file but bulbs never create CI; how do they fit?
- Kind: product
- Decision: Setup is an owner-run tool; the owner commits the files. The bulb itself never creates or edits workflow files.
- Decided by: user on 2026-11-14
- Why: resolves contradiction mvp.md:34 vs vision.md:41
- Source: docs/mvp.md:34; docs/vision.md:41-42

## notify.on accepts started, which is not an outcome; how to handle it?
- Kind: product
- Decision: Keep started as a separate lifecycle notification in the contract, distinct from outcomes.
- Decided by: user on 2026-11-14
- Why: resolves contradiction mvp.md:66 vs 100-110
- Source: docs/mvp.md:66,100-110,179

## Without the dashboard, where is task state saved between wake-ups and how does the bulb recognise PRs it opened or adopted?
- Kind: product
- Decision: State store interface with two adapters. Default stores compact JSON (task id, responsibility, attempts, cost so far, phase, caused_by; under 10 KB, never logs or transcripts) in a hidden comment on the bulb's PR, plus a bulb label; adopting a Dependabot PR writes the comment. Second adapter is the dashboard.
- Decided by: user on 2026-11-14
- Why: accepts reviewer proposal for open question 1
- Source: docs/mvp.md:192-193; docs/vision.md:95

## Must the 4-week goal work with the core alone or may it rely on the dashboard?
- Kind: product
- Decision: Core must stand alone. Dependabot PRs are adopted via a scheduled sweep using the owner's token plus an optional workflow_run trigger; vuln-patch uses its scheduled scan. Dashboard dispatch is an extra wake source, not a dependency.
- Decided by: user on 2026-11-14
- Why: this repo must never depend on the dashboard
- Source: docs/mvp.md:156-161,35; CLAUDE.md

## What may each responsibility edit?
- Kind: product
- Decision: Each responsibility declares a path allowlist in the contract. dep-updates and vuln-patch: manifests and lockfiles in configured directories. ci-fix: those plus source and test files in the same directories, capped by max diff size (about 200 changed lines), never never_touch or workflow paths. Edit outside scope ends as blocked.
- Decided by: user on 2026-11-14
- Why: runner must enforce scope in code
- Source: docs/mvp.md:133,83-86; docs/vision.md:36

## What happens to the weekly grouped PR if last week's is still open, and how does dep-updates avoid duplicating Dependabot PRs?
- Kind: product
- Decision: One rolling branch per directory (bulb/dep-updates/<dir>). If its PR is still open, the new week rebuilds from the default branch, re-applies bumps, force-pushes and resets the task; force-push is allowed only on bulb/* branches the bulb opened. Packages with an open Dependabot PR are excluded from the grouped PR and adopted. Each major gets its own PR, one per package.
- Decided by: user on 2026-11-14
- Why: keeps one open PR per directory; narrow exception to the no-force-push default
- Source: docs/mvp.md:119-122

## Do per_task budgets cover the whole task across wake-ups, and which outcome does exceeding them produce?
- Kind: product
- Decision: Budgets cover the whole task, summed across wake-ups and stored in task state. The cost limit is in Canadian dollars: the config key is per_task_cad (replacing per_task_usd in mvp.md). Minutes count runner wall time only, not CI waiting. Hitting a limit stops the engine immediately and ends the task as blocked with spend so far and a 'raise the budget or take over' decision.
- Decided by: user on 2026-11-14
- Why: user chose CAD for the cost budget; rest accepts reviewer proposal
- Source: docs/mvp.md:79-81,106

## How are the runner and Action distributed and versioned, and what form does the setup path take?
- Kind: product
- Decision: Runner on npm (@bulb-agent/runner, bin bulb), contract as @bulb-agent/contract, JS Action referenced as Arbelaezch/bulb-agent@v1. bulb init writes .bulb/config.yaml and .github/workflows/bulb.yml locally for the owner to commit and prints required secrets. npm scope @bulb-agent still to be confirmed by the owner.
- Decided by: user on 2026-11-14
- Why: accepts reviewer proposal; npm scope unconfirmed
- Source: docs/mvp.md:34,184-185

## How does the npm/pip adapter pick the package manager in mixed setups, and are pip transitive dependencies in scope?
- Kind: product
- Decision: Lockfile-driven: use the lockfile found in each configured directory (package-lock.json means npm); a yarn or pnpm lockfile gives blocked. family-food is configured with directories: [apps/web/family-food]. For pip, edit only pins already in requirements.txt; a vuln fix in an unlisted transitive package adds an explicit pin with a comment.
- Decided by: user on 2026-11-14
- Why: accepts reviewer proposal for open question 5
- Source: docs/mvp.md:15,70,198-199

## Does the MVP ship a second engine?
- Kind: product
- Decision: Claude engine only, with engine contract tests and a fake engine used by all runner tests. A generic tool-loop engine follows after the MVP.
- Decided by: user on 2026-11-14
- Why: accepts reviewer proposal for open question 3
- Source: docs/mvp.md:172-174,195-196

## What wakes a sleeping task to enforce the verification timeout, and what is the timeout?
- Kind: implementation
- Decision: Every scheduled tick, plus a light daily tick added by the setup path, sweeps the bulb's open PRs in waiting and ends any past the deadline as error. Default verify.timeout is 2 hours, configurable.
- Decided by: assumed on 2026-11-14
- Why: reviewer: idle is free so something must sweep; reversible default
- Source: docs/mvp.md:151

## What wire protocol do the dashboard reporter and state store adapters speak, and which repo defines it?
- Kind: implementation
- Decision: The dashboard API (endpoints, auth header, payloads using contract types) is defined as JSON Schema in contract, with this repo as source of truth. Both adapters are built and tested against a local mock server.
- Decided by: assumed on 2026-11-14
- Why: reviewer: keeps this repo independent of the private dashboard
- Source: docs/mvp.md:5,30-31,184

## Where does vuln-patch get alerts, and how does it treat existing Dependabot security PRs?
- Kind: implementation
- Decision: Scheduled scan uses npm audit --json and pip-audit (OSV-backed), and also reads the GitHub Dependabot alerts API when the token allows, deduping by advisory id. An existing Dependabot security PR for the same advisory is adopted, as dep-updates adopts version-update PRs.
- Decided by: assumed on 2026-11-14
- Why: reviewer: needs no extra token scope, avoids duplicate PRs
- Source: docs/mvp.md:127,160-161

## Which checks count as the repo's CI checks and what counts as a pass?
- Kind: implementation
- Decision: Use branch-protection required checks if any exist, otherwise all check runs and commit statuses on the head SHA except the bulb's own. Pass means all completed with success, neutral or skipped and at least one success. Any failure triggers ci-fix.
- Decided by: assumed on 2026-11-14
- Why: reviewer: bulb must not verify against its own check
- Source: docs/mvp.md:145-149
