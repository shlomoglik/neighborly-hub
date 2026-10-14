# Neighborly Hub — independent Next.js UI preview

This branch is a standalone Next.js App Router **UI-only preview**. It does not use Lovable Cloud, Supabase, a database, or authentication at runtime.

## Run locally

Requirements: Node.js 24 LTS and pnpm 10.18.3.

```bash
git fetch origin
git switch migration/nextjs-app-router
nvm install
nvm use
corepack enable
pnpm install
pnpm dev
```

Open http://localhost:3000/directory

Verify:

- /directory — search, building filter, household cards
- /household/1 — family details
- /join — form with mock confirmation only
- /manage — demo building list and local-only add
- /auth and /reset-password — visual-only forms
- Hebrew / English / Russian language switcher, RTL/LTR, mobile navigation

## Development checks and formatting

ESLint 9 checks the Next.js app code, and Prettier 3 formats it. Formatting rules live in `.prettierrc`, with generated and legacy files excluded by `.prettierignore`. ESLint and Prettier have separate responsibilities.

```bash
pnpm typecheck       # TypeScript check
pnpm lint            # ESLint check
pnpm format:check    # Check formatting without changing files
pnpm format          # Apply Prettier formatting
pnpm build           # Production build
```

The GitHub Actions workflow currently runs installation, typecheck, lint and build. `format:check` is available locally but is not enforced in CI until the migrated files have been formatted.

## Localization

The server and client share `src/lib/i18n/dictionary.ts`. Language selection is stored in the `neighborly_lang` cookie and controls document `lang`/`dir` and server-generated metadata. Hebrew is the default; English and Russian are also supported.

**Warning:** No user data is persisted; no real authentication, authorization, or backend is implemented. Do not deploy this preview as a real neighbors directory. All phone numbers are fake. The original TanStack/Lovable source files remain in the branch as migration reference and are not used by the Next.js app. The migration is not yet feature-parity complete.

## Planned backend

Implement independent PostgreSQL + Drizzle and an authentication provider, server-side authorization, and privacy rules before production. Do not reuse the previous Supabase RLS model without review.
