# Neighborly 2b — mockup reconciliation

Source of truth for visual requirements: `Neighborly 2b - Components.pdf` and `Neighborly 2b - Screens.pdf` (two-page mockups supplied by product owner).

## Design contract
- RTL-first using logical CSS properties; Hebrew and English supported, Russian fallback fonts (Nunito headings, Roboto body).
- Varela Round for Hebrew headings/family names, Heebo for body; tabular numerals for phone/apartment.
- Semantic palette: paper/bg, card, stone/surface, moss/sidebar, line, ink, muted, leaf/primary, primary-soft, honey, honey-soft, clay/danger.
- Spacing multiples of 4; radii 10 inner / 14 controls / 22 panels / pill; minimum 44px touch targets.
- Primary CTA at most one per view. Color must not be the only status cue.
- Breakpoints: <640 single column + bottom tabs; 640–1023 compact rail + details sheet; >=1024 240px sidebar + list + 360px detail.

## Coverage matrix
| Building block | Current PR #21 | Required next |
| --- | --- | --- |
| Tokens and typography | partial foundation story | exact palette, fonts, spacing, responsive demos |
| Button, input, badge, card, checkbox | stories | contact actions, validation, focus, loading, accessibility |
| Privacy/visibility selector | missing | admins/building/complex, policy constraints, per-field state |
| Family avatar | existing implementation, no story | squircle household / circular person / group, deterministic palette |
| Household row | missing | default, mine, birthday, hidden contact, selected |
| Resident/member row | missing | adults, children, masked contact, role |
| Ownership and approval badges | generic badge only | owner-occupier, tenant, absent owner, pending, approved, rejected |
| Birthday card | missing | upcoming, today, child age-only, month-only if supported |
| Apartment tile / floor map | missing | occupied, pending, vacant, absent owner, selected |
| Building hierarchy controls | missing | building tabs, floor groups, apartment selection |
| Join requests | missing | pending, approve/reject, conflict warning |
| Navigation | existing AppShell | resident/admin tabs, responsive layout, active state |
| Search and filters | DirectoryFilters prototype | controlled API, status filters, privacy-aware results |
| System feedback | missing | empty, error, stale/offline, privacy notice, success |
| Forms and join flow pieces | missing | step indicator, member editor, contact field, privacy control |
| Detail composition | missing | family details pane, mobile full-screen, tablet sheet |

## State boundaries
- Components receive typed view models and callbacks; no direct database/API access.
- Keep transient interaction local or controlled; shared state belongs to a future page-level owner.
- Permission and visibility must be enforced by backend; hiding UI is not authorization.
- Never expose a hidden phone/email in DOM, Storybook props or accessible labels when visibility disallows it.
- Do not implement unsupported assumptions as live functionality: invitation links, approval notifications, birthday month-only visibility, household conflict warnings and manager contact requests need schema/API review.

## Next implementation sequence
1. Correct design tokens and typography to the 2b spec.
2. Privacy selector, contact actions, household/person avatars and semantic status badges.
3. Household and member rows, birthday cards, empty/error/offline states.
4. Apartment tiles, floor map, join request card, responsive navigation.
5. Controlled composite forms and detail panels; stories for each state.
6. Validate RTL/LTR, keyboard interaction, mobile breakpoints, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm storybook:build`, `pnpm build`.

No full screens in this PR.
