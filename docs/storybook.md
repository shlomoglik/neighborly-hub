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

## Review screenshots

Screenshots run only on request, through the separate **Storybook screenshots** workflow. Automatic PR/push checks still build Storybook, but do not install a browser or capture images.

For a pull request, add the `screenshots` label to request one capture run (remove and re-add it to request another run). Alternatively, open **Actions → Storybook screenshots → Run workflow**, select the branch to review, and run it. The workflow builds that branch’s Storybook and captures seventeen real browser PNGs using an isolated pinned Playwright installation. Download the `storybook-screenshots` artifact from the workflow run. Captures cover Hebrew/English/Russian, mobile/tablet/desktop detail panels, privacy/forms, the apartment map, skeletons, and the project setup wizard’s project/buildings/review steps. They use synthetic story data and wait for local fonts; screenshots are review material rather than baseline comparison tests.

To run with a locally installed Playwright package, serve `storybook-static` on port 6006 and run `node scripts/capture-storybook.mjs`. Set `PLAYWRIGHT_MODULE_PATH` to its absolute `index.mjs` path when the tool lives outside this project.
