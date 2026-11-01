# PR-08A — Community surveys pilot contract

**Status: pilot product defaults approved; inert persistence implemented in PR-08B.**
PR-08C adds resident read/response endpoints; management and UI remain future work.
PR-08A (#88) and persistence PR-08B (#89) are merged.

**LAUNCH BLOCKER — real-person collection is not ready.** Retention/deletion period,
responsible operator, request procedure, backup expiry and withdrawal/erasure
handling remain unresolved. Schema and synthetic tests do not resolve this gate.

## 1. Evidence and scope

- [Vision](product-vision.md) separates community surveys from product research and
  leaves survey scope, anonymity and retention open. [G9](pilot-gap-audit.md#g9--community-surveys-and-results-are-absent--p1-for-survey-phase--pr-08-later)
  requires scoped publishing, eligible responses, concurrent uniqueness and restricted results.
- [Schema](../drizzle/schema.ts) and [SQL baseline](../database/migrations/0001_initial.sql)
  implement projects → buildings → apartments → households → household members,
  not independent building/complex/neighborhood community entities. Use one existing
  project as the pilot survey boundary; no inherited community permissions.
- [Grants](../src/lib/access/grants.ts) load `global_roles.role = 'admin'`, scoped
  `staff_assignments` (`project_manager` / `building_manager`) and active approved
  homes. [Management](../src/lib/access/management.ts) also admits building managers;
  its broad management-access flag is therefore insufficient for survey management.
- [Resident authorization](resident-authorization.md),
  [adult identity checks](../src/lib/access/family-access.ts) and
  [directory queries](../src/lib/access/directory.ts) provide the identity/membership
  joins. Directory visibility and household representation are separate permissions.
- [Product Feedback](product-feedback.md) already accepts all authenticated accounts
  and permits global-admin retrieval. Neither permission implies survey eligibility
  or authority. Share HTTP conventions, never its authorization service.

## 2. Approved pilot behavior

The product owner approved the pilot defaults below; section 5 records the remaining launch gate.

- One project, one required single-choice question, two to six ordered options per
  survey. Put the question directly on the survey; no question table, free-text
  answers, branching, targeting by building, scheduling or generic form builder.
- Start as `draft`; a valid draft already has its question and 2–6 options.
  Managers may edit/delete drafts. Only `draft → published → closed` transitions
  are allowed. Publishing freezes question, options and project permanently.
  Closing is manual and irreversible; corrections require a new survey. No ordinary
  deletion of published/closed surveys, including those with zero responses.
- Approved adult residents in any building of the project may read published/closed
  surveys and respond while published. This is project-wide participation even when
  `projects.directory_visibility = 'building'`; directory contacts stay unaffected.
- Count one authenticated account per survey, not one apartment, household or
  representative. Two adults sharing a home each participate; multiple homes in the
  project do not create extra votes. A manager/admin may vote only through their
  independent eligible resident membership. No proxy or child responses.
- First accepted answer is final. An identical retry while published succeeds;
  a different option conflicts. Closed surveys reject every response write,
  including retries; an eligible user can read their own saved answer to resolve
  an uncertain submission. No answer changes or withdrawal UI in this pilot.
- Only project managers/global admins see aggregate results, after closure and at
  least **five** surviving responses. Below five, return suppression without counts
  or total; no live totals, respondent lists, individual-answer export or breakdowns.
  Residents see their own answer/confirmation, not aggregate results in this slice.
  These are approved conservative defaults, not an anonymity guarantee.
- Survey text is authored once in its chosen language; do not add translated content
  storage initially. Later UI chrome, notices and errors must support HE/EN/RU.

## 3. Persistence entities and eligibility

The implemented model uses UUIDs, named constraints and `timestamptz` as in the
current schema. Store no duplicated person, household, building, email or contact data.

| Entity                       | Proposed fields and relationships                                                                                                                                                                                                                                 |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `community_surveys`          | `id`, required `project_id → projects.id`, nullable `created_by → app_users.id`, `question`, `state` (default `draft`), `created_at`, `updated_at`, nullable `published_at`, `closed_at`. Creator records provenance, never ownership or continuing authority.    |
| `community_survey_options`   | `id`, required `survey_id → community_surveys.id`, `label`, `position` (1–6). Option UUIDs freeze on publication; question/option content is editable only in draft.                                                                                              |
| `community_survey_responses` | Required `survey_id → community_surveys.id`, `user_id → app_users.id`, `option_id`, `created_at`; primary key `(survey_id, user_id)`. Composite `(survey_id, option_id)` references an option in that survey. No response UUID or extra submission key is needed. |

Eligibility is an `EXISTS` path for the session-derived account:
`app_users → user_person_links → people → household_members → households → apartments → buildings`,
with `people.is_child = false`, `household_members.is_managed_child = false`,
`households.is_active = true`, `households.approval_status = 'approved'` and
`buildings.project_id = survey.project_id`. Any matching home suffices. Do not require
`is_contact_person`; roommates and non-representative adults are eligible.

Approval belongs to the household, not to a general account/community membership
record. A pending request elsewhere does not cancel an existing eligible home.
An approved historical join request alone is insufficient after membership removal.
Ownership, invitation possession, matching email, `created_by`, staff grants and
directory access alone grant no response right. `loadGrants().homes` omits the explicit
child checks; do not use it alone as the survey eligibility predicate.

**Adult limitation:** `is_child` is an existing classification; birth date is optional
and is not verified age evidence. Recommend this classification for the pilot without
collecting more birth data. If “adult” must mean verified 18+, approval must define a
separate verification policy before launch; do not claim the current model proves age.

## 4. Authorization matrix

Every request verifies the current signed database session through
[getCurrentUser](../src/lib/auth/session.ts) and reloads relevant grants/membership.
No client role claims, cached permissions or author/creator bypasses. Grants combine
independently: use the resident row only when the same actor actually qualifies.

| Actor relative to route project                                  | Read published/closed and own answer | Submit while published         | Read drafts / create / edit draft / publish / close / delete draft | Read aggregate results |
| ---------------------------------------------------------------- | ------------------------------------ | ------------------------------ | ------------------------------------------------------------------ | ---------------------- |
| Signed out                                                       | No                                   | No                             | No                                                                 | No                     |
| Unlinked, pending-only, rejected-only, inactive or child account | No                                   | No                             | No                                                                 | No                     |
| Eligible adult resident                                          | Yes                                  | Yes, once                      | No                                                                 | No                     |
| Building manager only (even all buildings)                       | No                                   | No                             | No                                                                 | No                     |
| Project manager assigned to this project                         | Yes                                  | Only if independently eligible | Yes                                                                | Closed + threshold     |
| Global admin                                                     | Yes, any existing project            | Only if independently eligible | Yes, any existing project                                          | Closed + threshold     |
| Manager/resident of another project only                         | No                                   | No                             | No                                                                 | No                     |

Survey management uses the exact project-manager grant or global-admin grant, not
“any staff”, household representative, product-team membership or feedback access.
There is no new representative role/delegation system in this proposal. Loss of a
grant affects the next request, including creators; loss of residency removes resident
reads/writes but does not retroactively remove an already accepted response.

## 5. Privacy choices and required product decisions

| Model evaluated                          | Integrity and privacy trade-off                                                                                                                                                                                                                                                                            | Pilot recommendation                                                                                 |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Identifiable answers exposed to managers | Simple account uniqueness and deletion, but reveals who chose what and can discourage candid participation.                                                                                                                                                                                                | Reject individual-answer access through product APIs/UI.                                             |
| Confidential, account-linked storage     | Unique account key supports retries/deletion. Managers receive only aggregates, but trusted database operators/backups can link accounts to choices.                                                                                                                                                       | **Approved for pilot**, with explicit disclosure; this is not anonymous storage.                     |
| Anonymous answer storage                 | Removing the account key loses simple one-per-account enforcement and targeted deletion. A separate participation ledger plus unlinkable submission mechanism adds complexity; IDs, timing, logs or small groups can still permit correlation. Hashing a user ID alone is pseudonymization, not anonymity. | Defer; a genuine anonymity requirement needs a revised threat model and contract before schema work. |

No respondent/account identifiers, individual timestamps or participation rosters
reach aggregate endpoints. Do not log selected options, request bodies or raw driver
exceptions. Suppression and closed-only results reduce inference; small communities,
unanimous answers and comparisons after deletions still permit inference. Do not
promise secrecy against trusted operators or re-identification resistance.

**Product-owner decision record (2026-11-01):**

Items 1–4 below are approved pilot behavior. Item 5 remains open and blocks
real-person collection. Approval does not establish verified age evidence or
remove the need for localized pre-submit disclosure and integrated verification.

1. Project as community boundary; one single-choice question/2–6 options; adult
   classification; account response unit and immutable answers, rather than household voting.
2. Exact manager/global-admin authority; exclusion of building-manager-only accounts;
   project-wide participation despite building-only directory settings. This is pilot
   learning, not a legally binding ballot or proof of community representation.
3. Confidential account-linked storage, trusted operator access and pre-submit notice.
   Suggested meaning: “Your answer is linked to your account to prevent duplicate
   responses. Authorized project managers and global administrators see aggregate
   results only; trusted system operators can access stored answers.” Localize before launch.
4. Closed-only manager results, minimum five responses, no resident aggregate view,
   and accepted residual inference risk. Changing audience/timing/threshold requires
   updating this contract and tests, not silently widening access.
5. **OPEN — launch blocker:** Retention duration, responsible operator, deletion-request channel, backup expiry,
   disclosure of changing historical counts and whether withdrawal must be available.

The project scope, single question/2–6 options, account response unit, final answers,
manager authority, confidential account-linked storage and closed-only suppressed
results are approved. Inert schema and synthetic tests may proceed; the operational
retention/withdrawal policy remains undecided and real-person collection must remain disabled.

## 6. Retention and deletion

Recommend account deletion cascading to its responses and setting survey creator to
NULL, preserving the survey. Existing identity-verifier/invitation FKs may independently
restrict account deletion; do not promise self-service deletion (none exists today).
Deleting a person/link/home removes eligibility, not stored account-linked answers.
No automatic “former resident” participation or deletion policy is inferred.

Project deletion should cascade through surveys, options and responses. Ordinary
survey DELETE remains draft-only; approved privacy/retention erasure is a separate
trusted operator procedure, not a manager ability to manipulate published results.
Response erasure changes derived counts and can re-suppress results. If erasure occurs
while open, the uniqueness key disappears and the same still-eligible account can
vote again; inform the requester or close first under the agreed policy. Recreated
accounts also bypass per-account identity continuity; no anti-Sybil guarantee is made.

Do not store aggregate snapshots or add a retention scheduler yet. Before launch,
approve a concrete review/purge date or duration and operator procedure, including
backup expiration and deletion replay after restore. Do not promise immediate backup
erasure or indefinite retention. Sensitive personal-data questions are outside this
pilot; avoid collecting unnecessary personal information in question/option text.

## 7. API outline

The three resident routes below are implemented; management routes remain proposed.
They use the existing App Router, with server-only
services and strict Zod validation following the
[feedback boundary](../src/app/api/product-feedback/route.ts).
Use private/no-store and `Vary: Cookie` for successes and errors via
[managementResponse](../src/lib/access/management-response.ts). Writes require the
exact configured application Origin; body-bearing writes require JSON, fatal UTF-8
decoding and a 16 KiB actual stream limit. DELETE has no body. Reject unknown/repeated
query fields and unknown body fields.

| Method and path                                                                  | Request / response outline                                                                                                                                                                                                                      |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/projects/:projectId/surveys?page=1`                                    | Eligible resident list: published/closed only; `{ surveys, page, hasNext }`. Summaries: `id, question, state, publishedAt, closedAt`; no counts or participation metadata.                                                                      |
| `GET /api/projects/:projectId/surveys/:surveyId`                                 | Published/closed detail for eligible residents or managers: summary plus ordered `{ id, label, position }` options and `ownResponse: { optionId } \| null` for eligible residents only. Managers without residency receive `ownResponse: null`. |
| `PUT /api/projects/:projectId/surveys/:surveyId/response`                        | Strict `{ optionId: UUID }`; session supplies user. `200 { optionId }` for first save/identical open retry; changed answer conflicts. No supplied user/person/household/project IDs in body.                                                    |
| `GET /api/management/projects/:projectId/surveys?page=1`                         | Authorized manager list of all states, same summary fields (draft timestamps null). Same 20 rows/page, integer pages 1–10000, `created_at DESC, id DESC` ordering as resident list.                                                             |
| `GET /api/management/projects/:projectId/surveys/:surveyId`                      | Manager detail including drafts and ordered options; no respondent data.                                                                                                                                                                        |
| `POST /api/management/projects/:projectId/surveys`                               | `{ question, options: [{ label }] }`; server derives project, creator, positions and UUIDs. `201 { id }`. On uncertain create, reload management list before intentional retry; no exactly-once create guarantee.                               |
| `PATCH /api/management/projects/:projectId/surveys/:surveyId`                    | Same complete question/options payload, draft-only; `200 { id }`. Replace draft options atomically. Concurrent draft edits serialize, last committed edit wins.                                                                                 |
| `POST /api/management/projects/:projectId/surveys/:surveyId/publish` or `/close` | Empty JSON object; validate transition and locked content; `200 { id, state }`. Repeating the already-achieved state succeeds without changing timestamps; publish after close conflicts.                                                       |
| `DELETE /api/management/projects/:projectId/surveys/:surveyId`                   | Draft only, no request body; `200 { deleted: true }`. Repeat after deletion returns 404.                                                                                                                                                        |
| `GET /api/management/projects/:projectId/surveys/:surveyId/results`              | Closed only: `{ suppressed: true }` below threshold, otherwise `{ suppressed: false, total, options: [{ optionId, count }] }` in option order, including zeros. No identity fields, filters or exports.                                         |

Trim question/labels; propose 1–500 / 1–200 UTF-16 code units respectively,
well-formed Unicode without NUL, 2–6 distinct normalized labels. Render as plain text.
Reject unsupported list filters; resident lists use the eligibility predicate, not
directory-building scope. Pagination is stable for unchanged data, not across inserts/deletes.

Errors use `{ error: CODE }`: 401 `UNAUTHENTICATED`; 403 `FORBIDDEN` for invalid
write Origin; generic 404 `NOT_FOUND` for malformed/missing/out-of-scope route IDs,
ineligible project access or hidden drafts; 400 `INVALID_INPUT` for invalid JSON,
UUID body/query, options (including another survey's option) or limits;
409 `INVALID_STATE`, `SURVEY_CLOSED` or `ALREADY_RESPONDED` for authorized conflicts;
413 `PAYLOAD_TOO_LARGE`; 415 `INVALID_INPUT`; sanitized 500 `INTERNAL_ERROR`.
Check scope/eligibility before state, answer conflicts or results. Results before closure
return 409 `INVALID_STATE`. No response/option existence oracle across projects.

## 8. Migration, integrity and concurrency requirements

- Add the next available numbered file under [authoritative SQL migrations](../database/migrations),
  synchronize [Drizzle](../drizzle/schema.ts), and test through
  [pnpm db:migrate](deployment-migrations.md). Do not reserve a number here, rewrite
  applied files, use legacy `drizzle/migrations`, or add browser/Data API grants.
  Revoke PUBLIC and existing anon/authenticated table privileges as in
  [0009](../database/migrations/0009_product_feedback.sql).
- Named checks: state allowlist; nonblank bounded question/labels; option position
  1–6; timestamp consistency (draft: neither lifecycle timestamp; published: publish
  only; closed: both, close ≥ publish ≥ creation). Use UUID defaults and timestamp
  defaults matching the existing schema; application validation remains stricter.
- Unique `(survey_id, position)` and `(survey_id, id)` on options; response primary
  key `(survey_id, user_id)` enforces concurrent one-vote semantics; composite option
  FK prevents cross-survey choices. No duplicated project ID in options/responses.
  FK cascades: project → survey → options/responses; account → responses;
  creator account → SET NULL. Use a deferred `NO ACTION` composite option FK so a
  whole-survey cascade succeeds while deleting a referenced option alone fails.
- Enforce 2–6 options at transaction commit with a deferred constraint trigger on
  survey creation and option insert/update/delete; skip a deleted parent. All option
  edits lock the parent survey first, so concurrent deletions cannot leave one option.
  Draft replacements are atomic. Service checks plus SQL guards must prevent answers
  on drafts/closed surveys, response updates and post-publication content/option edits;
  option guards must allow parent-deletion cascades, and creator SET NULL must remain valid.
  tests must distinguish row CHECK/FK invariants from cross-row trigger/service rules.
- Index survey lists `(project_id, created_at DESC, id DESC)`; creator FK for account
  erasure; options already have survey-leading unique indexes; responses
  `(survey_id, option_id)` for aggregates/composite FK and `(user_id)` for account
  erasure. Do not add a duplicate index covered by a PK/unique prefix or cached totals.
- Reads use a consistent read-only repeatable-read snapshot for authorization and
  data, as current directory/management services do. Writes use short transactions;
  hold a shared lock on the actual authorizing admin/project-manager grant against
  revocation, following [existing grant locking](../src/lib/access/structure-management.ts).
  Survey-specific policy must exclude the building-manager scope that helper also permits.
- Response writes lock/recheck the linked non-child person and a qualifying
  membership/home/scope path against removal, deactivation or project change, then
  hold a shared survey-row lock while checking state and inserting. Management
  state/content writes hold an exclusive survey-row lock. Use one consistent lock
  order and deterministic row ordering; no external calls inside transactions.
  Close and response therefore serialize: a vote committed before close counts;
  a writer observing closed fails. SQL uniqueness arbitrates simultaneous same/different
  choices; compare the winning row for retry/conflict. No select-then-unprotected-insert.
- Count stored responses, not joined memberships: multiple homes must never multiply
  results. Do not re-filter historical answers by current residency; erasures change
  counts, departing residents do not. Suppression and counts use the same snapshot.

## 9. Small follow-up PRs

1. **PR-08B — Persistence/integrity:** after product decisions, add the three tables,
   Drizzle declarations, SQL guards, FK/index/migration tests and synchronized DB
   documentation. No endpoints/UI; inert schema can be reviewed independently.
2. **PR-08C — Resident read/response API:** implement survey-specific eligibility,
   strict DTOs/HTTP boundary and concurrency tests. Seed draft/published fixtures in
   tests; do not expose a temporary publishing endpoint.
3. **PR-08D — Management/results API:** exact authority, draft CRUD, publish/close,
   suppression and cross-project/revocation tests. Depends on 08B; coordinate shared
   contract/service files with 08C or land sequentially to keep review small.
4. **PR-08E — Resident UI:** discoverability through existing navigation, answer
   form/confirmation/own-answer recovery, localized privacy notice and mobile states;
   depends on 08C and approved copy. No feedback-form coupling.
5. **PR-08F — Management UI/results:** minimal draft editor and publish/close/results
   actions with synthetic stories; depends on 08D. Run a two-building pilot journey
   once resident and management slices are integrated. No builder framework.

## 10. Acceptance and required verification

PR-08B implements SQL/Drizzle persistence and database integrity tests only.
Authorization, API, aggregate suppression and UI requirements below remain for
follow-up PRs; persistence alone does not deliver a usable survey feature:

- Disposable migrated PostgreSQL + real signed-session integration fixtures with
  two projects/two buildings, two adults in one home, a multi-home adult, pending-only,
  rejected/inactive/unlinked/child accounts, building/project managers and global admin.
  Verify every matrix cell, mixed grants and account-vs-household response unit.
- Removal/revocation of identity link, membership, household approval/activity and
  staff/global grants takes effect next request; concurrent revoke/write outcomes
  follow lock order. Non-representative adults work; ownership/creator/approved-request
  shortcuts fail; building-only directory configuration does not change survey policy.
- Full draft/create/edit/delete → publish → answer → close → suppressed/results
  lifecycle; immutable published content/options; no reopen; empty/invalid/1/7-option
  drafts rejected. Transactional option replacements and concurrent removals preserve bounds.
- Concurrent identical responses persist one row and succeed; different choices
  yield one winner/409. Cross-survey option FK, duplicate votes, invalid states,
  response mutation, close/answer races and retry-after-close behavior are tested
  against SQL, not only mocks. Rollbacks leave no partial options/votes.
- Aggregates include zero options, sum to `total`, suppress at 0–4, expose at 5,
  and do not multiply a multi-home user's vote. Account erasure updates counts and
  suppression; identity/home removal preserves historical votes. Test whole-project
  cascade, creator SET NULL and option deletion restriction together.
- No endpoint leaks another user's answer, IDs/timestamps/roster, pre-close totals,
  drafts or cross-project existence. Verify no-store headers on failures, forged
  identity/role rejection, Origin/content-type/UTF-8/stream limits, unknown/repeated
  fields, plain-text rendering and sanitized errors/logs. Feedback permissions stay unchanged.
- Run migration lifecycle/constraint suites and relevant unit/integration tests in
  existing CI, then typecheck/lint/build. UI slices add HE/EN/RU, RTL/LTR, keyboard,
  loading/empty/expired/revoked/uncertain-save checks at mobile width using fictional
  data. Record the integrated resident/manager journey before declaring surveys delivered.

## 11. Persistence implementation notes (PR-08B)

Migration `0011_community_surveys.sql` is authoritative. SQL text limits use
PostgreSQL character length (500/200); future API validation retains the stricter
UTF-16 limits from section 7. No endpoint, fixture containing real people, retention
interval, automatic purge or self-service withdrawal is introduced.

Option identities/survey assignment are immutable even in drafts; replace options
atomically instead. Each option mutation writes/locks its parent before deferred
count validation: read-committed writers serialize and stale repeatable-read writers
abort rather than validating an old snapshot. Future services must lock the survey
before option rows to avoid deadlocks; direct conflicting SQL may abort and retry.
Response inserts take a shared survey lock, including INSERT ON CONFLICT retries;
updates always reject. Idempotent retry comparison belongs to PR-08C and must occur
under this lock while still published. SQL does not assert resident eligibility.

Creator provenance cannot be reassigned; FK SET NULL on account deletion is allowed
in every state. Published/closed survey deletion is allowed only during project
cascade (parent is absent), not ordinary manager deletion. Account-response erasure
remains possible for trusted backend operators; no user-facing erasure promise is
made. The deferred composite option FK permits whole-survey erasure but rejects
orphaned answers. RLS without browser policies and revoked table/function privileges
keep the foundation backend-only; deployment runtime ownership/BYPASSRLS must follow
the existing server database model. Reconcile scoped runtime privileges when the
open staging infrastructure PR (#58) lands; do not grant browser roles access.

## 12. Resident API implementation notes (PR-08C)

Resident listing requires current residency; published/closed detail additionally
admits exact project managers/global admins. Managers without residency always
receive `ownResponse: null`, including when a historical response exists. Drafts
remain hidden on these routes. No publication endpoint or UI is introduced, and
section 5's real-person collection gate remains in effect; use synthetic fixtures.

Reads authorize and select in one read-only repeatable-read snapshot. Writes lock
all qualifying identity/person/member/home/apartment/building rows in membership-ID
order, recheck eligibility in a fresh read-committed statement after lock waits,
then acquire a shared survey lock. Locks survive through response insertion and
winning-row comparison. Closure and eligibility removal therefore serialize with
submission. Management must acquire its grant before the survey; do not introduce
survey-first operations that subsequently lock resident paths. SQL deadlock victims
or unexpected failures produce sanitized errors; read own response before retrying.

The response body has exactly one UUID field; duplicate keys (including escaped
spellings), extra query/body fields and repeated pagination fields are rejected.
UUID choices are canonicalized before retry comparison. No participant counts,
account identifiers or other residents' choices are serialized or logged.

Signed-session PostgreSQL tests are included in the database CI job: authorization
matrix, two buildings and projects, shared/multiple homes, immutable concurrent
responses, actual lock waits in both closure/revocation orders, historical response
preservation, boundary validation and private response headers. Management/results
and integrated resident/manager UI verification remain PR-08D/08E/08F work.
