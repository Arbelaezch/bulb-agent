# Bulb MVP: open-source core (`bulb-agent`)

Status: first draft, 2026/11/13, for the owner to correct before `/factory-plan`. Read [`vision.md`](vision.md)
first for the terms (bulb, responsibility, task, outcome, adapter). The paid dashboard's MVP is in
[`dashboard-mvp.md`](dashboard-mvp.md); it is built in a separate private repo, and this repo must not depend on it.

## 1. Goal

One bulb on each of the owner's two repos keeps their dependencies current and their security alerts patched for
**4 weeks**, with the owner only hearing about work that is ready for approval, blocked or broken.

| Repo | Stack | Checks today | Notes for the bulb |
|---|---|---|---|
| `Arbelaezch/Personal-Website` | Django 5.2 LTS, Python 3.12, exact pins in `requirements.txt`, self-hosted on Ubuntu | GitHub Actions: migrations check, `check --deploy`, tests | **Merging to `main` deploys production** (health check and automatic code rollback). Repo rules: releases at least 14 days old, stay on Django 5.2 LTS until MySQL 8.4+ (issue #80). |
| `Arbelaezch/family-food` | Next.js 15.5, React 19, Node 24, deployed on Vercel | No CI; Vercel builds each PR and posts a deployment status | App lives in `apps/web/family-food/` with its own `package-lock.json`; the root `package.json` declares yarn workspaces. |

### Done means
- The bulb is installed on both repos and has run on schedule for 4 weeks.
- Routine updates arrive as one weekly grouped PR per repo; security alerts as their own PRs.
- When a bulb PR's check fails, the bulb tries to fix it before involving the owner.
- Every stop reaches the owner as `ready`, `blocked` or `error`, with what it tried and what it needs.
- No change reaches `main` without either the owner's approval or an explicitly enabled auto-merge with a passing check.

## 2. In scope

1. The **contract** in JSON Schema with generated TypeScript types: bulb config, wake event, task state, outcome.
2. The **runner**: reads config, takes a wake event, enforces policy, scope and budget, runs the steps and the
   engine, saves and resumes task state, emits the outcome.
3. **Adapters**: GitHub Actions host; GitHub and schedule wake sources; Claude engine behind a pluggable engine
   interface; pull request change channel; reporters for PR comment/check, generic webhook, dashboard and stdout;
   state store with a PR-comment default and the dashboard as an optional second adapter.
4. **Three responsibilities**: `dep-updates`, `vuln-patch`, `ci-fix` (section 5).
5. **Package ecosystems**: npm and pip (`requirements.txt`). Others later.
6. A **setup path** that installs the bulb on a repo: the workflow file, the config file and the secrets it needs.
7. Documentation good enough for a stranger to install and configure a bulb without the dashboard.

## 3. Out of scope for the MVP

Servers and direct apply; hosts other than GitHub Actions; ecosystems other than npm and pip; a registry or sharing of
third-party responsibilities (the config format must allow `uses:` references later); managed model keys (bring your
own key only); answering by email or chat reply; a fleet manager across repos; fixing failures on `main` or on PRs
the bulb did not open or adopt; creating or changing CI.

## 4. The contract

### Bulb config
One file per repo: `.bulb/config.yaml` (a home fleet repo is a later feature; the format should allow defaults to be
inherited). Illustrative, not final:

```yaml
version: 1
engine:
  provider: anthropic          # pluggable; chosen per bulb
  model: claude-sonnet-5-5
  effort: medium
context:
  include: []                  # extra files the bulb reads at startup, e.g. [CLAUDE.md]
verify:
  commands: []                 # optional, off by default; e.g. ["npm ci", "npm run build"]
  working_directory: .
merge:
  auto_merge: false            # opt-in per bulb
  require_verified: true       # never auto-merge without a passing check
notify:
  webhook: ${{ secrets.BULB_WEBHOOK_URL }}   # Discord / Slack / ntfy compatible
  on: [ready, blocked, error]  # optionally also: started (lifecycle notification), done
responsibilities:
  dep-updates:
    schedule: weekly           # default; configurable per bulb
    directories: [apps/web/family-food]
    allow: [patch, minor]      # grouped PR only; each major gets its own PR, one per package, never auto-merged
    min_release_age: 7d
    hold: {}                   # e.g. { django: "5.2.x" }
    group: weekly
  vuln-patch:
    enabled: true
  ci-fix:
    attempts: 2
budget:
  per_task_cad: 1.00           # Canadian dollars
  per_task_minutes: 15
safety:                        # every rule can be changed, deliberately
  never_touch: [".env*", "**/secrets/**"]
  never_push_default_branch: true
  never_force_push: true
  workflow_files: blocked      # editing .github/workflows/** stops the task as `blocked`
```

Policy that the runner can enforce in code (release age, holds, allowed update types, paths, budgets) lives in the
config, not in a prompt. The owner may also point `context.include` at files such as `CLAUDE.md`; by default a
responsibility reads only what its job needs (manifests, lockfiles, the failing check's log).

### Wake event
Normalised from every source: `id`, `source` (github, schedule, dashboard, bulb), `type`
(e.g. `dependabot.pr.opened`, `security.alert`, `check.completed`, `schedule.tick`, `action.retry`), `repo`,
`payload`, and **provenance**: `caused_by` (the event or task that led to it) and `depth`. The runner refuses events
past a maximum depth, so a bulb can't loop on its own pushes.

### Outcome
Every task ends in exactly one:

| Outcome | Meaning | Owner's move |
|---|---|---|
| `done` | Finished; nothing needed (merged under auto-merge, or nothing to update). | None. |
| `ready` | Work is ready for approval (a PR). | Approve and merge, or close. |
| `blocked` | Stopped by a rule or permission (a workflow file, a held package, a missing secret, a path outside scope). | Grant it, or take over. |
| `error` | Something else broke and the bulb couldn't fix it within its limits. | Look into it. |
| `skipped` | Woke up but the event isn't something it handles. | None. |

While asleep mid-task the state is `waiting` (shown as in progress). An outcome carries: a one-line summary, what it
tried, why it stopped, the decision needed (for `blocked`/`error`), links (PR, run, logs), the verification signal
used, and cost. Outcomes are also emitted as wake events, so a later manager can listen to them.

`started` is a lifecycle notification sent when a task begins; it is separate from the outcomes above and does not
end a task.

## 5. Responsibilities

### `dep-updates`
- **Wakes on** its own schedule (default weekly) and on Dependabot version-update PRs.
- **Own check**: finds outdated packages (`npm outdated`, `pip list --outdated` or an equivalent), filters by
  `allow`, `min_release_age` and `hold`, applies the bumps deterministically, and opens **one grouped PR per week**.
  Each major gets its own PR, one per package, never auto-merged; `allow` governs only the grouped PR and
  auto-merge.
- **Dependabot PRs are adopted**: the bulb works on Dependabot's branch instead of opening a duplicate, and treats it
  like its own PR from then on (including `ci-fix`). A Dependabot PR that breaks the policy (too new, held package)
  gets a comment and the outcome `blocked`.
- Uses the model only when a deterministic bump fails (conflicting peer versions, a lockfile that won't resolve).

### `vuln-patch`
- **Wakes on** security alerts and on findings from its own scheduled scan (an OSV-style audit for npm and pip).
- Bumps to the **smallest version that fixes the advisory**, one PR per alert, never grouped with routine updates.
- Applies the same holds; if the fix needs a held or major version, the outcome is `blocked` with the advisory and options.

### `ci-fix`
- **Wakes on** a failed check on a PR the bulb opened or adopted. Never on `main` or other people's PRs.
- Reads the failing log, fixes within the responsibility's scope, pushes, sleeps until the check reruns.
- At most `attempts` tries (default 2), then `error` with the diagnosis.

## 6. Task lifecycle and verification

1. Wake → runner loads config and any saved task state.
2. Deterministic steps, then the engine only if needed.
3. **Local verify** (optional `verify.commands`) before pushing.
4. Push to a branch, open or update the PR, save state, **stop** (`waiting`).
5. The check result wakes the same task (resumed from saved state, not restarted).
6. Pass → `ready`, or merge if `auto_merge` and verified → `done`. Fail → `ci-fix`. Out of its depth → `blocked`/`error`.

**Verification signal**, first one found wins:
1. The repo's CI checks on the PR.
2. A platform check already on the PR, such as **Vercel's deployment status** (this is family-food's case).
3. The bulb's own `verify.commands`.
4. None → the PR is labelled **unverified** and is never auto-merged while `require_verified` is on.

If no check reports within a timeout, the task ends in `error`.

## 7. GitHub specifics the build must handle

These came up in design and are easy to get wrong; each needs checking against GitHub's current behaviour.
- **Pushes made with the default `GITHUB_TOKEN` do not trigger other workflows.** Bulbs must push with a GitHub App
  installation token (or, without the dashboard, a token the owner provides), or the repo's CI never runs.
- **Workflows triggered by Dependabot PRs get a read-only token and no Actions secrets.** Adopting Dependabot PRs
  needs a design that works with this (for example the dashboard dispatching the run, or a `workflow_run` trigger).
- **Security alerts may not be available as a workflow trigger.** They may need to arrive through the GitHub App
  webhook and the dashboard, with the scheduled scan as the no-dashboard path.
- **Changing files in `.github/workflows/` needs a special permission.** By default that stops the task as `blocked`.
- **On Personal-Website, merging deploys production.** Auto-merge there means auto-deploy.

## 8. Keys and secrets

Bring your own: the model API key and (without the dashboard) a GitHub token are repo or org secrets on the host.
The runner never prints secrets, never passes them to the model, and never commits them.

## 9. Engines

The engine interface takes a task, its context, the allowed tools and a budget, and returns edits plus a transcript
and cost. It must fit both an SDK with its own coding tools (Claude Agent SDK) and a generic tool loop over a
multi-provider SDK. The MVP ships the Claude engine; provider, model and effort are set per bulb.

## 10. Notifications

Without the dashboard: a PR comment for every outcome on that PR, and a generic webhook (works with Discord, Slack
and ntfy) for the outcomes the owner chose (default `ready`, `blocked`, `error`; optionally the outcome `done` and the lifecycle
notification `started`, sent when a task begins).
With the dashboard: everything also goes to the task's thread there, which routes it on (see `dashboard-mvp.md`).

## 11. Repo layout and quality

- A TypeScript monorepo, Node 24: `contract` (schemas and generated types, published to npm so the dashboard can
  use it), `runner` (CLI: `bulb run --event <file>`), `adapters/*`, `responsibilities/*`, and the GitHub Action.
- Tests: unit tests for policy and budget enforcement and for each adapter; fixture repos (npm and pip) for each
  responsibility; one end-to-end run against a throwaway sandbox repo before installing on the real repos.
- License: Apache-2.0. The repo is public from the design stage on.

## 12. Open questions for the owner

1. **State without the dashboard.** **Decided:** a state store interface with two adapters; the default keeps compact
   JSON task state in a hidden comment on the bulb's PR plus a bulb label, and the dashboard is the second adapter.
2. **Default `min_release_age`.** Proposal: 7 days (Personal-Website sets 14).
3. **A second engine in the MVP.** **Decided:** the Claude engine only, with engine contract tests and a fake engine
   for runner tests; a generic tool-loop engine follows after the MVP.
4. **The owner's own installs** exceed the free limit of 1; the dashboard needs an owner override.
5. **family-food's mixed setup** (yarn workspaces at the root, an npm lockfile in the app). **Decided:**
   lockfile-driven per configured directory (family-food uses `directories: [apps/web/family-food]`, a yarn or pnpm
   lockfile gives `blocked`); pip edits only existing pins, and a fix in an unlisted transitive package adds an
   explicit pin with a comment.
