# Storybook

Storybook lives in the application repository and reuses the existing React UI components and Tailwind theme.

## Commands

```bash
pnpm storybook
pnpm storybook:build
```

Open the local Storybook at http://localhost:6006.

The toolbar supports Hebrew (RTL), English (LTR), and Russian (LTR). The first stories are for existing UI primitives. They intentionally do not depend on database queries, authentication, or Next.js server components.

## Scope

- UI-01 establishes the isolated component workbench without changing application screens.
- UI-02 will align semantic tokens and typography with design direction 2b.
- Feature stories should use synthetic fixtures and never import server-only modules.
