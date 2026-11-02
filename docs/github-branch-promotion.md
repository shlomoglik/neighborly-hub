# Branch promotion and GitHub rulesets

## Release flow

Feature and Dependabot updates → PR into `staging` → Preview deployment and CI → PR **from `staging` to `main`** → Production.

Both `staging` and `main` are permanent branches. Do **not** delete `staging` after promotion. The promotion workflow checks the exact source branch and repository for every PR to `main`.

## Configure protection in GitHub

Repository administrator: **Settings → Rules → Rulesets → New branch ruleset**. Two separate active rulesets are required; GitHub Actions alone cannot prevent direct pushes or branch deletion.

### Rule for `staging`

Target exactly `staging`. Enable:
- Require pull request before merging, and require conversation resolution.
- Require status checks: `verify`, `database`, and `Pilot browser journey` (select the exact check names GitHub shows).
- Block force pushes; restrict deletions (including accidental post-merge auto-deletion).
- No bypass actors; if a separate reviewer is unavailable, do not require approval count greater than zero.

### Rule for `main`

Target exactly `main`. Enable:
- Require pull request before merging, and require conversation resolution.
- Require status checks from **Next.js checks**: `verify`, `database`, `Pilot browser journey`.
- Require **Production promotion gate / Require staging source**. This workflow fails any PR whose head is not the exact `staging` branch in this repository.
- Block force pushes and deletion; avoid bypass actors.
- Prefer an up-to-date required check set when GitHub offers it.

Make both rulesets **Active** rather than Evaluate. For a public repository under a personal account, verify availability of required features before treating this as enforced. Required checks must appear in a real workflow run before being selectable. Confirm enforcement by opening a harmless test PR to `main` from a non-`staging` branch and verifying it is blocked; also verify a PR to `staging` runs required checks.

**Important governance limitation:** A required workflow stored in the same repository can itself be modified by PRs. Protect changes to `.github/workflows/` through review or organization-level rules where supported.

## Dependabot

`.github/dependabot.yml` uses `target-branch: staging` for npm and GitHub Actions **version updates**. Existing Dependabot PRs opened against `main` must be retargeted or recreated. Dependabot **security updates** may still target the repository default branch (`main`) based on GitHub platform behavior; handle those via `staging` before promotion. Never merge a bot PR directly to `main`.

## Full E2E acceptance gate (future)

The existing `Pilot browser journey` exercises the app with a disposable PostgreSQL database and is already eligible as a required status check.

When the separate E2E project is introduced, add a PR workflow that **always** runs for `main` promotions, with a stable job name such as `E2E / full-suite`. Tests must be isolated from Production. After proving that the check runs and fails correctly, add it to the `main` required checks. A failed, missing or cancelled E2E suite must block promotion. Until the job exists, never require an imaginary check name.

## Manual rollout check

1. Confirm `staging` exists and tracks the current merged `main`.
2. Activate both rulesets, then verify direct pushes/deletion are blocked.
3. Confirm Dependabot PRs target `staging`, and no ordinary PR targets `main`.
4. Open `staging` → `main` only when preparing a release; require all mandatory checks.
5. Keep `staging` after merging the release PR.
