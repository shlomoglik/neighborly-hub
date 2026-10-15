# Next.js migration status

The application uses Next.js App Router. Legacy Lovable, TanStack Start, Vite and Supabase runtime source has been removed. PostgreSQL/Drizzle, Google sessions, explicit user/person links and project/building/contact read authorization are implemented.

`/directory` is now a protected live-data feature with authorized project discovery, server-side search and pagination. Household details, joining and management remain synthetic previews. Storybook remains independent of authentication and database setup.

## Still to implement

1. Scoped manager workflows for verifying resident identity and approving households.
2. Authorized household detail and editing endpoints before connecting those previews.
3. Deployment configuration and a real Google consent/token-exchange smoke test.

See [authentication](authentication.md) and [resident authorization](resident-authorization.md) for prerequisites, privacy rules and verification. SQL migrations 0001–0004 are authoritative.
