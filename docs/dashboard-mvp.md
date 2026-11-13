# Bulb MVP: dashboard

Status: first draft, 2026/11/13. This document lives in `bulb-agent` for now so everything is reviewed together. When
the private dashboard repo is created, copy this file and [`vision.md`](vision.md) there and run `/factory-plan` in
that repo. The core it builds on is in [`mvp.md`](mvp.md).

## 1. Goal

A basic hosted dashboard where the owner sees every bulb, follows each task as one thread, and acts on it (approve
and merge, retry, answer, grant, pause) without opening GitHub. It also holds task state so bulbs can resume.

## 2. Stack and hosting

- Next.js on Vercel, Postgres, TypeScript. Uses the `contract` package published from `bulb-agent` (it does not copy
  the schemas).
- Hosted SaaS only. Tentatively `bulb.modularmonolith.ca`; may move to its own domain. Whether it shares a backend
  with other modularmonolith projects is decided later.
- **Depends on `bulb-agent`**: the contract package must be published, and the dashboard reporter and state store
  adapters exist on the core side. Issues here that need them must say so.

## 3. In scope

1. **Sign in with GitHub.**
2. **The Bulb GitHub App**: install on chosen repos; receives webhooks (Dependabot PRs, security alerts, check
   results) and turns them into wake events; mints installation tokens so bulb pushes trigger CI (see `mvp.md` §7).
3. **Fleet list**: one row per install. Repo, status (idle, in progress, needs you), last outcome, next scheduled run.
4. **Task threads**: one thread per task. Start, progress, waiting on checks, result, cost, links to the PR and runs.
5. **Actions** (each sends a wake event to the bulb, via `repository_dispatch` or similar):
   - **Approve and merge**: always available on `ready`, whether auto-merge is on or off.
   - **Retry**.
   - **Answer**: reply to a `blocked` or `error` question; the task resumes with the answer.
   - **Grant**: approve the permission a `blocked` task asked for, for this task only.
   - **Pause** one bulb, **pause all**, and resume.
   - **Run now**.
6. **State store**: saved task context for resuming, pending approvals, pause flags, run history. Config is not
   stored here; it lives in git (see below).
7. **Notifications**:
   - Every outcome lands in its thread.
   - **Email** with a link to the thread, for the outcomes the owner chose (default `ready`, `blocked`, `error`).
     With auto-merge on, the owner may also get `started` and `done`; with it off, `ready` asks for approval.
   - The same generic webhook as the core (Discord, Slack, ntfy).
8. **Settings**: notification choices per bulb. Bulb config edits are made by **committing to the repo's
   `.bulb/config.yaml`** (a PR, or a direct commit if the owner allows), so git stays the single source of truth.
9. **Free limit**: 1 install on the free tier, with an owner override. Billing comes right after the MVP.
10. **Audit log**: every action taken through the dashboard and every token minted.

## 4. Out of scope for the MVP

Billing and paid tiers; managed model keys; answering by email or chat reply; mobile push; a responsibilities
registry; dashboard-held config; a fleet manager; servers.

## 5. Security

The dashboard holds the GitHub App's private key and can push to users' repos, so: least-privilege App permissions,
encrypted secrets at rest, short-lived installation tokens, every action recorded in the audit log, and no model API
keys stored in the MVP.

## 6. Open questions for the owner

1. **Email provider** (for example Resend) and sender domain.
2. **Config edits from the dashboard**: always a PR, or allow direct commits to the default branch when the owner
   turns it on?
3. **How the GitHub Action authenticates to the dashboard** to fetch an installation token and report outcomes.
   Proposal: GitHub's OIDC token for the workflow, exchanged by the dashboard, so users store no extra secret.
