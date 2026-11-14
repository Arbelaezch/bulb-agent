# Bulb: Vision

Status: first draft, 2026/11/13. Written from the design conversation; the owner reviews and corrects it before
`/factory-plan` runs. The MVP is in [`mvp.md`](mvp.md) (open-source core) and
[`dashboard-mvp.md`](dashboard-mvp.md) (paid dashboard).

## 1. What Bulb is

A bulb is a **dormant caretaker for a repository**. It costs nothing while idle. It wakes when something happens
(a Dependabot pull request, a security alert, a failed check, a weekly schedule, a button in the dashboard), does a
small, low-risk upkeep task end to end, uses the repo's existing checks to confirm the work, fixes what it can, and
reports to its owner only when the owner is needed.

The first job is the one every developer with many side projects knows: dependencies go out of date and security
alerts pile up. Most updates are routine; one or two break something small. A bulb does the routine ones and handles
most of the small breakages, so the owner only sees "merged", "ready for you to approve" or "I need you for this".

### Who it's for
1. **Solo developers with many side projects** (first users, the MVP target). Many repos, little time, no wish to
   babysit each one.
2. **Freelancers and small agencies** who look after client sites (later).
3. **Self-hosters and homelab owners** who want the same care for their servers (later; needs its own discovery of
   what tools they already use).

### The one outcome that matters
The owner can leave their projects alone for weeks and trust that routine upkeep happens, and that anything
needing them reaches them as **one clear message per repo**, with the decision they need to make.

## 2. Design pillars

1. **Idle is free.** Nothing runs or bills between wake-ups. While waiting (for CI, for an answer) a bulb saves its
   state and stops.
2. **One bulb per repo, one point of contact.** A bulb holds several *responsibilities* (dependency updates,
   security patches, fixing its own failed checks). The owner talks to one bulb per repo, not to a swarm. More than
   one bulb per repo is allowed by the contract but is not the normal case.
3. **Narrow and enforced.** Each responsibility declares what wakes it, what it may touch, and what it may spend.
   The runner enforces those limits in code; the model is never trusted to stay in bounds on its own.
4. **No lock-in.** Bulb is a portable runner plus adapters. Where it runs (GitHub Actions first, later other CI,
   servers, containers), what wakes it, which model provider does the work, and where results go are all adapters
   around one contract. Each bulb can choose its provider, model and effort.
5. **Uses what the repo already has.** CI and tests are the owner's responsibility. A bulb uses them when they
   exist and never creates or manages CI. When there is no check at all, the bulb says so and refuses to auto-merge.
6. **Safe by default, configurable deliberately.** Defaults are conservative (auto-merge off, never touch secrets,
   never push to the default branch). Every safety rule can be changed per bulb, explicitly, by the owner.
7. **Asks rather than guesses.** When a bulb stops, it says what it tried, why it stopped, and exactly what it
   needs. `blocked` means a rule or permission stopped it (the owner grants it or takes over). `error` means
   something else broke and needs the owner.
8. **Config in git, state in a pluggable store.** What a bulb does lives in the repo (or a home "fleet" repo) and is
   reviewable and portable. Live task state (waiting, saved context, attempts, cost so far) is saved through a state
   store adapter. The core works on its own without the dashboard and by default keeps compact state in a hidden
   comment on the bulb's own PR. The dashboard is an optional state store and reporter that adds history, pause and
   pending approvals across the fleet, which is part of why it is worth paying for.

## 3. Terminology

| Term | Meaning |
|---|---|
| **Bulb** | The caretaker agent for one repo: its config, responsibilities and history. |
| **Install** | One bulb on one repo. Pricing counts installs. |
| **Responsibility** | One kind of work a bulb does (e.g. `dep-updates`, `vuln-patch`, `ci-fix`), with its own wake rules, policy, scope and budget. Responsibilities are the shareable, open-source building blocks. |
| **Wake event** | A normalised event that wakes a bulb (a Dependabot PR, an alert, a check result, a schedule tick, a dashboard action). It records what caused it, so chains can be traced and capped. |
| **Task** | One piece of work from wake to outcome, possibly across several wake-ups (do the update, sleep while CI runs, wake on the result, fix, sleep again). |
| **Outcome** | How a task ends: `done`, `ready`, `blocked`, `error` or `skipped`. While asleep mid-task it is `waiting` (shown as in progress). |
| **Host** | Where the runner executes: GitHub Actions first; later other CI, servers, containers. |
| **Engine** | The model provider and agent loop that does the reasoning (Claude first; pluggable). |
| **Adapter** | A small piece that connects the runner to one host, wake source, engine, change channel or reporter. |
| **Change channel** | How work lands: a pull request (MVP), applied directly (servers, later) or reported only. |
| **Fleet** | All of an owner's bulbs. A **home repo** can hold shared config for the fleet. |
| **Dashboard** | The paid hosted app: fleet view, task threads, remote actions, notifications, and an optional state store. |

## 4. Product shape

- **`bulb-agent` (open source, Apache-2.0).** The contract (JSON Schema), the runner, the adapters and the starter
  responsibilities. Anyone can run it without the dashboard and write their own responsibilities.
- **Bulb dashboard (paid, hosted SaaS only).** Fleet view, one thread per task, remote control (run now, retry,
  answer, grant, approve and merge, pause), notification routing, an optional state store for resuming tasks (the core keeps state on its own PRs without it), and later
  managed model keys, a registry of responsibilities and bundled usage. Tentatively hosted at
  `bulb.modularmonolith.ca`, possibly its own domain later. Not self-hostable.

The free core sends plain notifications (PR comments, a webhook). The dashboard adds the smart part: one thread per
task, grouping, routing rules, and acting directly from a notification.

## 5. Architecture

One contract, many adapters. The contract is defined in **JSON Schema** (so runners in other languages are possible
later); the first runner is **TypeScript**.

| Layer | Job | MVP | Later |
|---|---|---|---|
| Contract | Bulb config, wake event, task state, outcome | JSON Schema + generated TS types | versioned, stable |
| Wake sources | Turn outside events into wake events | GitHub (Dependabot PRs, security alerts, check results), schedule, dashboard actions | GitLab, Vercel deploys, CVE feeds, any webhook, files, server events |
| Hosts | Run the runner, provide credentials | GitHub Actions | GitLab CI, a server (systemd timer or listener), containers, serverless, local |
| Engines | Do the reasoning and editing | Claude | other providers and agent loops, chosen per bulb |
| Capabilities | What the bulb may touch | git, package managers, declared commands | MCP servers, cloud APIs, OS packages |
| Change channels | How work lands | pull request | direct apply with approval and rollback, report only |
| Reporters | Where outcomes go | PR comment/check, generic webhook, dashboard, stdout | email replies, chat replies, mobile push |
| State store | Saved task context for resuming | PR comment (default: compact JSON in a hidden comment on the bulb's PR, plus a bulb label); dashboard (optional) | others |

A task is: **wake → (cheap deterministic steps) → agent only if needed → verify → change channel → wait → report**.
Deterministic steps (run the bump, run the build) come first so the model is only paid for when judgement is needed.

## 6. Roadmap after the MVP

Design for these; don't build them in the MVP.

- **Billing and the paid tier** right after the MVP (see Business).
- **More responsibilities**: broken deploy (a production deploy fails), runtime end-of-life (Node/Python versions),
  lockfile hygiene, broken links, and community responsibilities.
- **Sharing responsibilities**: referenced from git like GitHub Actions (`uses: owner/responsibility@v1`), pinned to
  exact commits in a `bulb.lock`. Later a **registry** in the dashboard indexes them, with verified publishers.
- **Servers.** A bulb on a server (Ubuntu, no Docker is the owner's own case) for what `unattended-upgrades` does not
  cover: reboot decisions, a service broken by an update, held packages, release upgrades, reporting. Servers bring
  **risk tiers** per responsibility (report only < pull request < apply with approval < apply automatically) and
  **rollback** for anything applied directly. Most users will stay on report only; that's fine.
- **More hosts and platforms**: GitLab, other CI, Vercel/Netlify deploy events.
- **A fleet manager**: one view and one conversation across all repos ("12 sites updated, 2 need you").
- **Dashboard-held config** for repos where owners don't want files (client sites).
- **Answering by reply**: reply to an email or chat message to answer a blocker; mobile push with action buttons.
- **Managed model keys** in the dashboard for the whole fleet (MVP is bring-your-own key).
- **A stateless mode** that rebuilds context from the PR instead of resuming saved state.
- **A usage-included tier** (see Business).

## 7. Business

- **Pricing counts installs** (one bulb on one repo). Adjust once there are real customers.
- **Free**: 1 bulb. The owner pays their own model bill.
- **Paid (cheap, monthly)**: a large step up in bulbs (e.g. 10, then more). The free tier exists to funnel people
  into this tier, not to be lived on.
- **Usage-included tier (later, expensive)**: the dashboard brokers model usage and does more of the work for the
  owner. Most won't buy it; a few are enough. It means reselling model usage, so it needs metering and margin.
- **Platform risk is accepted.** GitHub or Vercel may build parts of this. Bulb's lasting angle is being
  cross-platform and fleet-wide, and the open core means users never lose their setup.

## 8. Non-goals

- A general automation platform (Zapier, n8n). Every responsibility is narrow: a specific wake signal, a specific job.
- Creating or managing CI for users.
- A self-hostable dashboard.
- Large or risky changes (feature work, refactors, migrations to new frameworks). Those belong to tools like the
  software factory, not to a caretaker.
