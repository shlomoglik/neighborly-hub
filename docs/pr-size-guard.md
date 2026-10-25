# Pull request size guard

The `PR Size Check (Effective LOC)` workflow measures changed lines from GitHub's PR files API. It adds one report comment and updates that comment after subsequent pushes or PR edits. The report includes raw additions/deletions by category and the five files with the highest weighted contribution.

| Category                                       | Addition weight | Deletion weight |
| ---------------------------------------------- | --------------: | --------------: |
| Source/configuration                           |               1 |            0.25 |
| Tests (`*.test.*`, `*.spec.*`, `__tests__/`)   |             0.5 |            0.15 |
| Documentation (`docs/`, `.md`, `.mdx`, `.txt`) |             0.1 |             0.1 |
| Recognized generated files                     |               0 |               0 |

Classification precedence is generated files, documentation, tests, then source. Recognized generated files are pnpm/npm/Yarn lockfiles, `*.min.js`, names containing `.gen.`, and files under `dist/`, `build/`, `storybook-static/`, `coverage/`, or `.next/`. Other files count as source; the guard does not inspect file contents to infer generated output. Tests support JS/TS, JSX/TSX and Node module extensions. A renamed file uses the higher-weight category of its old/new paths for both additions and deletions. An unchanged rename contributes zero. Binary files with no line changes also contribute zero; this is a line metric, not a complete measure of review effort.

Scores preserve two decimal places. Up to 400 passes; greater than 400 through 800 warns; greater than 800 fails the workflow after publishing the report. Making that failure block merging also requires a repository branch protection/ruleset requirement; this PR does not change repository rules.

The privileged workflow uses `pull_request_target`, checks out the immutable trusted base event SHA with credentials persistence disabled, installs no project dependencies and never executes PR code. Only the reporting step receives the GitHub token. It needs contents read and pull-requests write permissions. Per-PR concurrency cancels older runs; the runner also checks the event head and rechecks head/base before publishing, rejecting obsolete or incomplete results. It updates only a report marked as its own from `github-actions[bot]` and renders filenames as literal text. API failures fail the job rather than produce a partial success report. GitHub's 3000-file API limit is checked explicitly; larger PRs require manual review/splitting.

The calculation and mocked API tests also run in the normal unprivileged `pull_request` CI, including this first PR:

```sh
node --test .github/scripts/pr-size*.test.mjs
```

The privileged workflow becomes active after it reaches the default branch. Its live comment and failure behavior must be checked on a subsequent PR. No AI split advisor or external integration is included.
