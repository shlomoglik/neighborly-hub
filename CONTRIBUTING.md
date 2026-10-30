# Contributing to Neighborly Hub

Contributions that help neighbors connect are welcome. Read the canonical
[product vision](docs/product-vision.md) and [repository guidance](AGENTS.md)
before starting. The vision describes direction, not a commitment to implement
every future capability.

## Discuss and scope the change

- Search existing issues and pull requests to avoid duplicate work.
- For a bug, describe the expected behavior, reproduction steps and relevant
  environment. Use synthetic examples and redact logs or screenshots.
- For a substantial feature or architecture change, open an issue first to agree
  on the problem and scope. Small fixes can go directly to a pull request.
- Keep each pull request focused. Avoid unrelated refactoring, speculative
  infrastructure and new dependencies when existing patterns suffice.

## Set up locally

Use Node.js 24 and pnpm 10.18.3, as specified in `.nvmrc` and `package.json`.

1. Fork the repository, clone your fork and create a descriptive feature branch
   from the latest upstream `main`.
2. Enable Corepack and install the locked dependencies:

   ```sh
   corepack enable
   pnpm install --frozen-lockfile
   ```

3. Follow [local environments](docs/local-environments.md) for environment files,
   a local database and authentication. Use your own development credentials and
   synthetic data. Never run fixtures or test migrations against production.
4. Start the local environment with `pnpm dev:local`. For isolated component work,
   `pnpm storybook` provides previews without production secrets.

See the [README](README.md) for routes, implementation status and further docs.

## Implementation conventions

- Follow the existing Next.js App Router, TypeScript, Tailwind and component
  patterns. Avoid unnecessary abstractions and dependencies.
- Use the established dictionary for user-facing copy. Support Hebrew, English
  and Russian, including RTL/LTR layout and accessible keyboard interactions.
- Preserve authentication, authorization and per-community privacy boundaries.
  Never substitute preview data for a failed live-data request.
- Use authoritative SQL migrations for schema changes and keep related schema
  definitions and documentation aligned. Consult
  [database foundation](docs/database-foundation.md) and
  [deployment migrations](docs/deployment-migrations.md) first.
- Update tests for meaningful behavior changes and documentation when behavior,
  setup or contracts change.

## Verify your changes

Format the files you changed, then check them explicitly:

```sh
pnpm exec prettier --write <changed-files>
pnpm exec prettier --check <changed-files>
```

Replace `<changed-files>` with explicit supported file paths. `pnpm format` formats
all files and may introduce unrelated changes, so use it only deliberately.

Run these checks in order; the build regenerates `.next/types`, so do not run it
concurrently with typecheck:

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

For component or story changes, also run `pnpm storybook:build`. Database and pilot
integration tests need isolated services; see the
[pilot environment guide](docs/pilot-environment.md). Report skipped checks and
missing prerequisites rather than presenting them as passed. GitHub Actions runs
additional database, Storybook rendering and pilot browser checks.

## Submit a pull request

Target `main` and explain the concrete problem and resulting behavior. Include:

- **Implemented:** What changed and why; link a related issue when available.
- **Verified:** Commands actually executed, results and any skipped checks.
- **Remaining:** Limitations, unresolved questions or setup requirements.

For visible UI changes, include screenshots using fictional data and verify
mobile layouts and RTL/LTR behavior. Keep code, identifiers and technical
documentation in English unless the existing content uses another language.

Review the diff for unrelated files, secrets and generated output. Keep PRs small;
the [PR size guard](docs/pr-size-guard.md) reports their weighted size. Investigate
CI failures, respond to review feedback and leave merging to maintainers.

## Privacy and security

Never put real residents' names, contact details, children's information, session
cookies, invitation tokens or credentials in issues, commits, screenshots or test
fixtures. Use the existing privacy controls and least-privilege access patterns.
Read [security and environment guidance](docs/security-and-env.md).

Do not publish sensitive vulnerability details in a public issue. Use GitHub's
private vulnerability reporting if available; otherwise ask a maintainer for a
private reporting channel without including exploit details or confidential data.

## Contribution licensing

By submitting a contribution, you agree to license it under the project's existing
[MIT License](LICENSE). Contribute only work you have the right to license this
way. No copyright assignment is required. Preserve existing copyright notices and
third-party license notices, and identify any newly introduced third-party code or
assets and their licenses in the pull request.
