# Neighborly Hub — independent Next.js UI preview

This branch is a standalone Next.js App Router **UI-only preview**. It does not use Lovable Cloud, Supabase, a database, or authentication at runtime.

## Run locally

Requirements: Node.js 22+ and npm.

```bash
git fetch origin
git switch migration/nextjs-app-router
npm install
npm run dev
```

Open http://localhost:3000/directory

Verify:

- /directory — search, building filter, household cards
- /household/1 — family details
- /join — form with mock confirmation only
- /manage — demo building list and local-only add
- /auth and /reset-password — visual-only forms
- Hebrew / English / Russian language switcher, RTL/LTR, mobile navigation

```bash
npm run typecheck
npm run build
```

**Warning:** No user data is persisted; no real authentication, authorization, or backend is implemented. Do not deploy this preview as a real neighbors directory. All phone numbers are fake. The original TanStack/Lovable source files remain in the branch as migration reference and are not used by the Next.js app. The migration is not yet feature-parity complete.

## Planned backend

Implement independent PostgreSQL + Drizzle and an authentication provider, server-side authorization, and privacy rules before production. Do not reuse the previous Supabase RLS model without review.
