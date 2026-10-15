# Next.js migration status

The Next.js App Router UI preview was merged into `main`. The legacy Lovable, TanStack Start, Vite, and Supabase runtime source has since been removed. The application currently runs on mock data only.

## Still to implement

1. Connect authenticated identities to approved household membership.
2. Enforce project/building authorization and per-contact visibility on the server.
3. Replace mock resident data with authorized queries and validate production readiness.

Automated checks, PostgreSQL/Drizzle infrastructure and the [Google authentication/session foundation](authentication.md) are implemented.

See the root README for local development commands. Do not use the UI preview with real resident data before authorization and privacy checks are implemented.
