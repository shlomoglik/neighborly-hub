# Storybook

Storybook lives in the application repository and reuses existing React primitives, semantic Tailwind tokens and the typed application dictionary.

```bash
pnpm storybook
pnpm storybook:build
```

Open http://localhost:6006. Use the locale toolbar for Hebrew (RTL), English or Russian (LTR). It changes actual translations and text direction, including dialogs rendered through portals. Fonts are bundled locally; previews need no external font service.

## Catalog

- **Foundations/Neighborly 2b**: palette, multilingual typography and spacing.
- **UI**: button variants/busy behavior, badges, input validation, cards and controlled checkbox.
- **Features/Directory/Filters**: search, reset, building/ownership filtering and selection.
- **Features/Community/Building Blocks**: visibility/policy, apartment maps, request decisions, households, birthdays and system feedback.
- **Features/Community/Composites**: member form/child defaults/errors, mixed-script rows, navigation, join progress, detail panel, avatars, building selector and birthday summary.
- **Features/Community/Loading and Motion**: nine skeleton geometries, manual loading-to-content transition and cancellable busy-button demo.

Stories own transient state, use synthetic fixtures and do not call APIs or import server modules. Toggle the operating system's reduced-motion preference to inspect motion accessibility. Use browser widths 390, 768 and 1280px to inspect the three layout modes. The a11y addon is enabled; keyboard checks cover native privacy/building radio groups, form controls and Radix detail dialogs.

`pnpm test` covers locale rendering, interpolation/plurals, contact privacy, child defaults, controlled callbacks, filtering/reset, apartment selection, resident/admin navigation, request busy state, modal Escape behavior and skeleton replacement. Rendering/build success alone is not a visual or full accessibility audit.

See [ui-component-roadmap.md](ui-component-roadmap.md) for coverage and intentionally deferred product assumptions.
