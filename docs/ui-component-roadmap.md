# UI component roadmap

PR #21 extends the Storybook foundations toward reusable screen-ready components without implementing pages.

## Existing primitives
Reuse the existing shadcn-style primitives in `src/components/ui`. Do not duplicate their implementation. Add documented stories for each, including interaction, disabled, invalid, empty and loading states where applicable.

## Composition layers
- Foundation: semantic tokens, typography, RTL/LTR, spacing, elevation.
- Primitive: buttons, inputs, selections, dialogs, feedback, navigation, data display.
- Composite: searchable lists, filters, forms, entity summaries, empty states, confirmation flows.
- Domain: building hierarchy, apartment, household, resident, directory and management widgets.
- Screens: intentionally excluded; compose these parts later.

## State contract
Prefer local controlled state for reusable interaction, explicit callbacks for parent coordination, and props for remote data. Do not introduce a global store before cross-screen requirements are implemented. Keep persistence, authorization, and API calls outside presentational components.

## Verification
Run `pnpm storybook:build`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build`. Inspect mobile and RTL stories before merging.
