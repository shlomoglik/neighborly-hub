# Dependency maintenance policy

- Pin direct production and development dependencies to **exact versions** in `package.json`.
- Keep `pnpm-lock.yaml` committed and use `pnpm install --frozen-lockfile` in CI.
- `.npmrc` sets `save-exact=true` for future installs.
- This PR does **not upgrade installed packages**. It pins each direct dependency to the version already selected by the committed lockfile, and updates only the lockfile importer specifiers.
- Dependabot checks npm/pnpm dependencies and GitHub Actions weekly, opens reviewable PRs, and groups low-risk updates. Security update PRs require GitHub's dependency graph, Dependabot alerts and security updates to be enabled in repository settings; those settings cannot be enabled by this PR alone.
- Dependabot may update `package.json` and `pnpm-lock.yaml` together. Keep exact pins when reviewing its PRs.
- Do not automatically merge dependency PRs. Review security advisories, release notes, and CI before merging.
- The PR's exact pins reflect the **current main branch**. PR #10 adds Drizzle dependencies separately; after merging both PRs, ensure those additions are also pinned and the combined lockfile is regenerated/reconciled.
- The `dependencies` label should exist in repository settings for Dependabot to attach it; otherwise GitHub may omit the label.
