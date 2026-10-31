# PR-00 — Residential pilot gap audit

Audited `main` at `4ab2f721a7b5d6be135814fc1f1c325e14362b5c`.
Scope: neighbor discovery and learning through product feedback/community surveys.
[Product vision](product-vision.md) defines intent; implementation defines current behavior.
This is a source audit, not a declaration that the deployed pilot or physical-device journey passed.
P0 = stop launch for a confirmed critical security/data-integrity failure; P1 = resolve before the affected pilot capability launches; P2 = useful follow-up.
No P0 defect was established by this audit. P1 decisions and device checks below remain launch gates.

## Verified capabilities — preserve these

| Area                  | Current implementation and evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Account and joining   | Google and verified email/password registration are implemented in [SignIn](../src/features/auth/SignIn.tsx) and [auth setup](../src/lib/auth/create-auth.ts). [Token page](../src/app/join/[token]/page.tsx) and [return-path validation](../src/features/auth/return-path.ts) preserve valid invitation destinations. Authentication alone grants no residency.                                                                                                                                                    |
| Invitations           | Fixed-apartment, reusable building, existing-household adult and staff flows exist. [invitations.ts](../src/lib/access/invitations.ts): `submitJoin`, `reviewJoinRequest`, `renewInvitation` preserve pending requests, lock approval, reuse verified identity and rotate hash-only secrets. [InvitationWorkspace](../src/features/invitations/InvitationWorkspace.tsx) already offers renewal/re-sharing. Do not rebuild these.                                                                                     |
| Approval and recovery | [RequestList](../src/features/invitations/RequestList.tsx) displays pending/approved/rejected states and destination links after approval. History is embedded in [account](../src/app/account/page.tsx); [legacy /join](../src/app/join/page.tsx) redirects there. Polling/refresh exists; renewal is not a missing feature.                                                                                                                                                                                        |
| Directory             | [ResidentDirectory](../src/features/directory/ResidentDirectory.tsx) uses live adult rows, household/building/apartment context, all-buildings or one-building filtering, search, pagination, skeletons and access/error states. [use-directory](../src/features/directory/use-directory.ts) debounces, cancels stale requests and rechecks access.                                                                                                                                                                  |
| Global search         | [GlobalSearch](../src/features/search/GlobalSearch.tsx), [API](../src/app/api/search/route.ts) and [directory service](../src/lib/access/directory.ts) search authorized projects and visible phone/email values. Hidden contacts cannot create matches. This is delivered, not a future PR.                                                                                                                                                                                                                         |
| People/households     | [households.ts](../src/lib/access/households.ts) lists own homes, reads adult profiles, permits representative household renaming and self-only contact edits. [family.ts](../src/lib/access/family.ts) manages private children; [family-access.ts](../src/lib/access/family-access.ts) requires a verified adult representative, not merely staff/admin. One adult alone is supported.                                                                                                                             |
| Privacy/integrity     | [grants](../src/lib/access/grants.ts), [directory](../src/lib/access/directory.ts) and [household reads](../src/lib/access/households.ts) exclude children from ordinary discovery and filter contacts server-side. [0001](../database/migrations/0001_initial.sql), [0004](../database/migrations/0004_resident_identity.sql), [0005](../database/migrations/0005_invitations.sql), [0006](../database/migrations/0006_household_members.sql) constrain active occupancy, identity, scope and household membership. |

The reviewed tests substantiate intended behavior, not fresh test results:
[invitation integration](../src/lib/access/invitations.integration.test.ts) covers renewal, identity reuse and concurrent approval;
[directory integration](../src/lib/access/directory.integration.test.ts) covers multi-building/project isolation and hidden-contact search;
[household integration](../src/lib/access/households.integration.test.ts) covers self-only edits/conflicts;
[family integration](../src/lib/access/family.integration.test.ts) covers children and existing-household joins.

## Confirmed gaps and measurable acceptance

### G1 — First-use orientation and approval handoff · P1 · PR-01

- Evidence: [ResidentDirectory](../src/features/directory/ResidentDirectory.tsx), `unlinked`, gives generic access text and refresh only; it does not link to request history. [JoinInvitation](../src/features/invitations/JoinInvitation.tsx), `data.request`, sends approved residents to history rather than directly to their next action.
- Impact: a new or returning pending resident must discover the account menu; an approved resident can find the directory via history but receives no invitation-page prompt to complete contacts.
- Smallest change: add history/navigation guidance and approved-state links to the existing directory and own-households screens. Preserve account-versus-membership separation and the existing polling/approval flow.
- Acceptance: signed-out invitation → Google or email registration/verification → same invitation → pending → approval → directory/own contacts works using visible UI links at 390px; no guessed URLs or API-derived household IDs. Unlinked, rejected and unavailable states each explain a safe next action without revealing another account's details.

### G2 — Occupied-apartment invitation ambiguity · P1 · PR-01

- Evidence: [invitations.ts](../src/lib/access/invitations.ts), `invitationContext` lists apartments without an occupancy filter; `submitJoin` accepts a resident request, but `reviewJoinRequest` rejects an already-active household with `APARTMENT_OCCUPIED`.
- Impact: a second adult using the building QR can wait for approval of a request that cannot be approved through that flow. The separate household-member invitation already solves the underlying membership need.
- Smallest change: explain “first resident” versus “join an existing household” before submission, and document the representative-issued household link/recovery path. Do not merge households, auto-approve or disclose occupancy to applicants.
- Acceptance: two adults can reach one household through the documented two invitation types; an occupied-apartment conflict leaves one active household and offers actionable recovery to the reviewer. Existing race/uniqueness tests remain intact.

### G3 — Discovery empty states and search scope · P2 · PR-02

- Evidence: [ResidentDirectory](../src/features/directory/ResidentDirectory.tsx) renders the same generic empty component with or without filters and labels the query only “Search”. [directory.ts](../src/lib/access/directory.ts) matches names/household/apartment locally but phone/email only in global search.
- Impact: residents cannot distinguish an empty community from restrictive filters, or understand why a phone search succeeds only through the header search.
- Smallest change: distinct filtered-empty guidance with reset, unfiltered-empty guidance and explicit local/global search hints. Keep existing server filtering and pagination; multi-select is not required for the pilot.
- Acceptance: zero-data and zero-match states have different text; reset clears query/building and returns page 1; visible contact search is discoverable. HE/EN/RU and keyboard behavior are covered; no unauthorized counts or contacts are added.

### G4 — Loading interruption during browsing · P2 · PR-02

- Evidence: [use-directory.ts](../src/features/directory/use-directory.ts) clears rows on every 30-second refresh/focus/filter change; [ResidentDirectory](../src/features/directory/ResidentDirectory.tsx) replaces them with a skeleton. This is deliberate privacy behavior, not missing loading support.
- Impact: reading a long mobile list can be interrupted repeatedly. Source establishes replacement; the extent of visual movement still needs device measurement.
- Smallest change: preserve layout/focus around loading and measure before adding caching. Do not retain contact values across invalidation as a cosmetic fix.
- Acceptance: at 390px, changing filters and waiting through two refreshes causes no horizontal overflow or lost input focus; revoked/hidden/session-expired data still disappears. Record any remaining vertical movement rather than claiming it is fixed without measurement.

### G5 — Household language and personal identity editing · P2 · PR-03 (later)

- Evidence: [JoinInvitation](../src/features/invitations/JoinInvitation.tsx) requires `householdName`; [dictionary](../src/lib/i18n/dictionary.ts), `familyName`, calls it “Family display name”. [household mutation contract](../src/lib/access/household-contracts.ts) supports rename/contact operations, not adult-name edits; [account](../src/app/account/page.tsx) shows authentication name separately.
- Impact: a single resident/roommates can join, but family-centric wording is misleading. Correcting a resident-name typo has no self-service operation, and changing an account name must not silently redefine verified identity.
- Smallest change: household-neutral copy/examples first, without new schema. Treat adult self-name correction as a separately reviewed authorization change on the existing person record.
- Acceptance: one adult completes onboarding without inventing relatives; roommate/solo labels render correctly. If name editing is approved, only the linked adult can edit, cross-project effects are explained and another adult's identity cannot be changed.

### G6 — Personal introduction fields are absent · P2 · PR-04/05 (later)

- Evidence: [people schema](../drizzle/schema.ts), [0001 SQL](../database/migrations/0001_initial.sql) and [directory DTO](../src/lib/access/contracts.ts) have no introduction, interests or skills. Live [MemberRow](../src/components/community/MemberRow.tsx) receives names/context/contacts; birth dates exist in storage but are not returned by the directory.
- Impact: discovery currently supports identification/contacting rather than richer “get to know me” profiles. Existing avatar/birthday presentation components do not establish live profile support.
- Smallest change after a field/visibility decision: PR-04 owns migration, validation and self-only writes; PR-05 owns editor/display. Start with an optional bounded introduction, not a generic profile-field framework.
- Acceptance: an adult can save/edit/remove the chosen field and see it after reload; unauthorized readers and all child discovery remain excluded; omission leaves existing residents unchanged. No birthday exposure is bundled in.

### G7 — Contextual visibility is narrower than the vision · P1 decision · PR-01; redesign deferred

- Evidence: [directory.ts](../src/lib/access/directory.ts) returns adult names and household/building/apartment context for every authorized row, with no per-person listing opt-out. [0001](../database/migrations/0001_initial.sql) stores visibility on global `contact_methods`, not per membership; [HouseholdWorkspace](../src/features/households/HouseholdWorkspace.tsx) already explains cross-project contact edits via `homeGlobalContacts`.
- Impact: contact privacy works, but it is not independent per-community profile visibility. A resident in multiple projects cannot choose different audiences per project for the same contact.
- Smallest pilot action: explicitly agree and explain listing scope before joining, contact defaults and global effects. Do not promise full contextual visibility or weaken managers-only defaults. Per-community overrides/opt-out require a separate schema/read-policy decision, outside a UX PR.
- Acceptance: pilot owners approve the disclosed scope; two-building checks confirm building/project/managers contact visibility and child exclusion. If opt-out or independent community controls are mandatory, defer real-data enrollment until that separately scoped change is verified.

### G8 — Product feedback has no persistence/API/UI · P1 · PR-06 then PR-07

- Evidence: the complete [API route tree](../src/app/api), [feature tree](../src/features), [schema](../drizzle/schema.ts) and authoritative [SQL migrations](../database/migrations) contain no feedback submission/retrieval entity or route. `InvitationFeedback`/`SystemFeedback` are status presentation, not feedback collection. [Vision](product-vision.md) explicitly calls collection a goal.
- Impact: residents cannot report product friction through the application, and the product team has no durable, authorized review path. PR-06 alone does not deliver user-facing collection.
- Smallest coherent backend: a dedicated feedback table and migration, bounded free text, server-derived author/time, optional authorized project context, authenticated submit and restricted product-team retrieval. Reuse current session, exact-Origin, validation and private-response conventions; decide reviewer access before coding.
- PR-07 adds one discoverable mobile form with audience/privacy copy and pending/success/failure states. No attachments, tickets, notifications or generic plugin framework are required.
- Acceptance: submission survives reload and is retrievable only by the agreed product reviewers; anonymous/forged-author/oversized/cross-origin submissions fail; ordinary residents/community managers cannot list others' feedback. Retry behavior does not silently duplicate a saved submission. UI confirms success only after persistence and preserves text on failure.

### G9 — Community surveys and results are absent · P1 for survey phase · PR-08+ (later)

- Evidence: the same [schema](../drizzle/schema.ts), [SQL migrations](../database/migrations) and [API tree](../src/app/api) contain no surveys, questions, responses or results endpoints. [Vision](product-vision.md) leaves question types/anonymity/retention open.
- Impact: the survey part of pilot learning cannot run in-app yet. This does not block an explicitly agreed directory-first phase; it does block calling the full learning scope delivered.
- Smallest coherent slice: scoped survey/question/response persistence, authorized publish/close, eligible-resident response, restricted aggregate results and corresponding minimal UI. Choose one initial question type and response unit; reuse existing project/building scopes, not product-feedback reviewer rights.
- Acceptance: only agreed community representatives publish/view results in their scope; only eligible members respond while open; the chosen one-response rule is enforced concurrently in SQL. Cross-project reads/writes fail; closed surveys reject writes; results reconcile with stored responses without exposing identifiers when anonymity is promised.

### G10 — Multi-building/device readiness evidence and guide drift · P1 · PR-01 + pilot owner

- Evidence: [pilot guide](pilot-environment.md) prescribes one building/two apartments; [browser smoke](../scripts/pilot/browser-smoke.mjs) creates “Pilot A”, uses fixture sessions and navigates directly to an API-discovered household after approval. It does not prove an unaided real-login journey across buildings.
- Existing [directory integration tests](../src/lib/access/directory.integration.test.ts) do cover building/project boundaries; do not describe those rules as unimplemented.
- Guide drift: [README](../README.md) still describes `/` as a landing page and auth as Google-only, while [root](../src/app/page.tsx) redirects and [SignIn](../src/features/auth/SignIn.tsx) supports email. The early “cannot retrieve/re-share later” discussion in [onboarding docs](invitation-onboarding.md) must be read with its later renewal section. [Migration guide](deployment-migrations.md) is the authority for history/baselining, not rerunning initialization SQL.
- Acceptance: record commit/device/browser and pass/fail for two buildings, building-only/community visibility, both enabled auth methods, renewal/old-link rejection, pending/rejected/approved recovery, adult join, hidden children/contacts and global search. Use visible navigation; verify QR scanning and actual share delivery separately. Update stale guide statements in the owning follow-up PR, without infrastructure changes.

### G11 — Approved-membership departure/recovery needs an operating policy · P1 · pilot owner; PR-03 follow-up

- Evidence: [household contracts](../src/lib/access/household-contracts.ts) expose no adult removal/move/deactivation; [family contracts](../src/lib/access/family-contracts.ts) only mutate managed children. [revokeInvitation](../src/lib/access/invitations.ts) revokes the invitation, not already-approved residency. [family docs](family-membership.md) explicitly defer adult removal and moves.
- Impact: revoking a link is not a way to remove a departed resident's directory access. Deactivating an entire household is also not equivalent to removing one adult.
- Smallest pilot action: designate a trusted operator and a reviewed, scoped correction/departure procedure; product must decide whether this manual route is acceptable before enrollment. A resident-lifecycle UI is separate from cosmetic PR-03 work.
- Acceptance: rehearse removing one adult's target membership without changing other household members or their other projects; next authorized read denies the removed scope and the client clears it on revalidation. Record who authorizes corrections and how mistakes are recovered; never infer revocation from invitation status.

## PR ownership, dependencies and conflicts

| Work item / suggested owner                | Disposition and boundaries                                                                                                                                                  |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PR-01 / onboarding engineer + pilot owner  | Keep G1/G2 and G7 disclosure; own G10 acceptance/runbook changes. Reuse invitations/auth/history. G11 operating decision is a launch prerequisite, not a hidden UX feature. |
| PR-02 / directory engineer                 | Keep narrowly for G3/G4. Drop any “implement global search”, basic building-filter or loading-state rebuild; those already exist.                                           |
| PR-03 / household engineer                 | Later G5. Separate identity/lifecycle authorization changes from copy. Do not redesign households to support a solo adult.                                                  |
| PR-04/05 / profile backend then UI         | Later G6; drop/defer both if optional introductions are not selected for this pilot. PR-05 depends on PR-04's contract and approved visibility.                             |
| PR-06 / feedback backend engineer          | Keep G8 after product reviewer/eligibility/retention decisions. Own schema/migration and API contract; do not grant community managers product-team access by implication.  |
| PR-07 / feedback UI engineer               | Later, depends on PR-06. Together they deliver G8; an API-only launch needs an explicitly agreed alternative collection channel.                                            |
| PR-08+ / survey engineer + community owner | Later G9 after survey decisions. Independent domain from feedback; do not reuse its access policy or make surveys depend on personal introductions.                         |

First parallel wave: PR-01 and PR-02; PR-06 can join once its product decisions are resolved.
PR-01 owns unlinked/history links in `ResidentDirectory`; PR-02 owns filters/empty/loading regions in that same file: agree ownership or land PR-01's small edit first.
All UI streams touch `dictionary.ts`; use separate keys and rebase normally after merges, preserving translations.
PR-06, PR-04 and PR-08 may touch `drizzle/schema.ts` and SQL numbering: serialize migrations against current `main` rather than reserve competing numbers.
PR-01 must not alter private-resource invalidation for PR-02; PR-07 may reuse request helpers without broad refactors.
No deployment work, plugin architecture, new community model or code implementation belongs in PR-00.

## Open product decisions — do not infer

1. Who verifies residency/adult status, how quickly, and whom does a stuck applicant contact? Name the pilot operator and approve G11 departure/correction handling.
2. Is automatic directory listing after approval acceptable with disclosed names/household/apartment scope? Is global contact visibility acceptable, including residents with another project membership?
3. Who exactly is the product-feedback reader? An existing global admin role is not automatically equivalent to the product team. May pending/unlinked accounts submit onboarding feedback? Decide attribution, retention/deletion and whether project context is optional.
4. Who may publish community surveys and view raw versus aggregate answers? Decide question types, person-versus-household response unit, anonymity, retention and small-group disclosure before schema/API work.
5. Are introductions required now, and are they global or community-specific? Do not collect children’s introductions or expose stored birth dates by default.
6. Agree pilot duration, enrollment target and numerical success thresholds for directory usefulness/new connections and feedback/survey participation. Decide whether directory-first launch precedes the learning UI; no analytics infrastructure is implied.

## Verification performed and limits

- Read the pinned repository tree, referenced implementation/tests, README/vision/onboarding/household/auth/pilot/environment guides, Drizzle schema and authoritative migrations 0001–0008; reconciled the supplied vision documents with the canonical repository version.
- Checked missing feedback/survey capability against the route/feature inventory and persisted schema, not merely documentation promises or component names.
- Formatted this file and checked it with repository-pinned Prettier 3.9.10/config; validated relative evidence paths against the pinned tree and checked document whitespace/scope.
- No application tests, database migrations, build, deployed-session or physical-phone checks were executed for this documentation-only audit. Existing test cases were inspected, not reported as newly passing.
- Review/CI status belongs to the PR. Product choices, real-device results and full pilot readiness remain unresolved until their owners record evidence.
