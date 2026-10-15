# Neighborly 2b — component coverage

Reference: `Neighborly 2b - Components.pdf` and `Neighborly 2b - Screens.pdf`, supplied by the product owner. This PR builds reusable presentation pieces, not application screens or backend integrations.

## Implemented

| Area               | Components and behavior                                                                                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Foundations        | Leaf primary at L=0.50, paper/card/stone/moss tokens, honey for pending and birthdays, 10/14/22px corners, 44px controls, typography and spacing stories                |
| Typography         | Self-hosted Heebo/Varela Round and Roboto/Nunito; OFL licenses included; mixed-script fallbacks, bidirectional names and LTR contact values                             |
| Privacy            | Per-contact `ContactField` and keyboard-accessible `VisibilitySelector`; building-only policy removes the complex option; child drafts default to managers              |
| Residents          | `HouseholdRow`, `MemberRow`, family/person avatars and grouped avatar examples; selected, primary, child and hidden-contact states                                      |
| Status             | Ownership and approval badges; labels supplement color; approve/reject callbacks, busy state and conflict warning                                                       |
| Birthdays          | `BirthdayCard` with age-only child text, localized next-occurrence date, greeting callback and `BirthdayBanner`                                                         |
| Buildings          | Controlled building radio selector, floor groups, stable apartment selection; occupied, pending, vacant and absent-owner text/frame cues                                |
| Directory          | Local filtering or controlled filter state; query/building/ownership filters, locale sorting, plural counts, selection callback and reset                               |
| Navigation         | Resident/admin variants; four/five items; mobile row, 80px tablet rail and 240px desktop sidebar; no invitation tab                                                     |
| Join pieces        | Controlled member editor, field validation messages, child privacy reset, birthday opt-in and accessible three-step indicator                                           |
| Details            | Household detail content and controlled responsive panel; full-width mobile dialog, tablet side sheet, 360px desktop aside; Radix focus management and Escape           |
| Feedback           | Empty, failure/retry, stale, private, success/undo and loading states                                                                                                   |
| Loading and motion | Nine data-free skeleton variants, loading/content boundary, busy buttons, short entry/color transitions and sheet enter/exit; reduced-motion support                    |
| Localization       | All PR UI and story copy uses the existing typed dictionary in Hebrew, English and Russian; immutable synthetic mixed-script fixtures remain untranslated intentionally |

## Component contracts

- Reusable components import `useI18n` from the router-independent context. The application provider retains cookies/router refresh; Storybook supplies the same dictionary and direction without a Next router.
- Parent owners provide view models, current selections, validation errors and callbacks. No component imports database clients, performs network requests or fabricates persisted success.
- Directory filters support local state or controlled `value`/`onChange`. All other form/navigation/selection composites are controlled.
- Pass only authorized contacts. `MemberView` models hidden contacts without a value; runtime contact actions also suppress hidden values and destinations. Client hiding is not backend authorization.
- Use `CommunitySkeleton` while data is unavailable, or wrap loaded content in `CommunityLoading`. Skeletons need no resident data, expose one localized busy status and contain no interactive controls.
- Use `Button loading` to prevent repeat submissions. The parent clears loading when its operation settles; UI components never start their own simulated network timers.
- Names are isolated with `bdi`; phone/email/apartment values remain LTR. Long labels wrap rather than truncate family names.
- Preview-only greeting/approval interactions demonstrate callbacks; they do not send communications or mutate records.

## Intentionally deferred to screen/backend work

Invitation links, approval notifications, card-completion percentages, recently-approved households, staff job descriptions, alternate-language names, month-only birthday disclosure and requests through the committee require schema/product/API decisions. Conflict warnings consume caller-provided data only. The UI does not infer or persist those features.

Full screen composition, routing and API integration remain outside this PR. Existing application screens continue using their current composition.
