# Repository guidance

- This is a Next.js App Router project; use Node 24 and pnpm (see `.nvmrc` and `package.json`).
- Work on feature branches based on `main`; submit focused pull requests for review.
- Do not reintroduce Lovable, TanStack Start, Vite or Supabase runtime dependencies.
- Keep server-only secrets out of Git and out of `NEXT_PUBLIC_` environment variables.
- Run `pnpm typecheck`, `pnpm lint`, and `pnpm build` before merging.
- The UI currently uses mock data. Do not expose real resident information without authentication, authorization and privacy enforcement.

- Before committing, run Prettier on changed supported source files. For GitHub API edits where local hooks do not run, format the files explicitly and verify CI before marking a PR ready.
