# Next.js migration status

The Next.js App Router UI preview was merged into `main`. The legacy Lovable, TanStack Start, Vite, and Supabase runtime source has since been removed. The application currently runs on mock data only.

## Still to implement

1. Automated tests for the Next.js app and formatting checks in CI.
2. PostgreSQL + Drizzle data access and migrations.
3. Authentication, server-side authorization and privacy enforcement.
4. Replace mock data with real data and validate production readiness.

See the root README for local development commands. Do not use the UI preview with real resident data before authorization and privacy checks are implemented.
