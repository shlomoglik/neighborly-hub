# Next.js App Router migration

This migration lives on `migration/nextjs-app-router`. Do not merge into `main` while Lovable sync remains in use.

## Target

- Next.js App Router and TypeScript
- Preserve Tailwind design tokens, Radix-based UI, and visual components
- Remove Lovable/TanStack Start and Supabase dependencies in later steps
- Own backend, database, authentication, and deployment independently

## Current pilot

- App Router root layout and `/directory` preview
- Searchable mock households; no database or authentication connection
- Original TanStack routes remain untouched until ported

## Next steps

1. Complete dependency cleanup and make Next.js the sole runtime.
2. Port i18n, AppShell and all pages while preserving RTL and interactions.
3. Replace Supabase data hooks with a server-side data access layer.
4. Introduce Drizzle/PostgreSQL, authentication, authorization, and tests.
5. Configure CI and independent deployment; cut over only after validation.

## Validation status

Not yet executed in CI or a local Next.js build. The repository still contains the original Vite/TanStack application and package scripts.
