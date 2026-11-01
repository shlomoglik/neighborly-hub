# Product feedback API (pilot)

Product Feedback is private, attributed research about Neighborly Hub, separate from
future community surveys. PR-06 supplies persistence/API only; PR-07 owns the form.
No project, household, contact details, device data or inferred membership is collected.

## PR-07 contract

Both methods use `/api/product-feedback`, a valid session cookie, and
`Cache-Control: private, no-store` / `Vary: Cookie` on successes and errors.

### POST

Send `Content-Type: application/json` and the exact configured application `Origin`.
All authenticated accounts may submit, including pending/unlinked accounts and staff.
The server derives the author from the verified session; unknown fields are rejected.

```json
{ "submissionId": "a client-generated UUID", "message": "Free-text product feedback" }
```

Message is trimmed, must contain 1–2000 UTF-16 code units, and cannot contain NUL.
The actual UTF-8 request stream is limited to 16 KiB, regardless of Content-Length.
Success is always `200 { "id": "saved record UUID" }`, including identical retries.
Generate a UUID once per submission and retain it with the text across uncertain
network failures. Retry with that same pair. Leading/trailing whitespace is normalized;
reusing the author's UUID with different normalized content returns 409. A different
author can use the same UUID independently. Do not rotate the key merely on timeout.
A new intentional submission needs a new key. No membership approval is required.

### GET

Only the existing **global admin** grant permits retrieval. Project/building roles
and residency do not. The service checks the current database grant, not a client role.
`?page=1` defaults to 1; integers 1–10000 only; 20 records per page. Unknown/repeated
parameters are rejected. Order is `created_at DESC, id DESC` with a matching index.
Offset pages are deterministic for unchanged data; new submissions/deletions between
requests can shift page boundaries. Refresh page 1 to see new submissions.

```json
{
  "feedback": [
    { "id": "UUID", "authorUserId": "UUID", "message": "Text", "createdAt": "ISO timestamp" }
  ],
  "page": 1,
  "hasNext": false
}
```

No author profile/email, submission keys or authentication data are returned. Render
message text as text, never HTML. This endpoint is not an administration dashboard.

### Errors

All errors use `{ "error": "CODE" }`:

| Status | Code                 | Meaning                                                       |
| ------ | -------------------- | ------------------------------------------------------------- |
| 400    | INVALID_INPUT        | Invalid JSON, UTF-8, body fields, message, UUID or pagination |
| 401    | UNAUTHENTICATED      | No valid session                                              |
| 403    | FORBIDDEN            | Incorrect/missing POST Origin or GET without global admin     |
| 409    | IDEMPOTENCY_CONFLICT | Same author/key with different normalized content             |
| 413    | PAYLOAD_TOO_LARGE    | Request exceeds 16 KiB                                        |
| 415    | INVALID_INPUT        | Unsupported content type                                      |
| 500    | INTERNAL_ERROR       | Unexpected failure; retry the same submission pair            |

## Persistence and lifecycle

`database/migrations/0009_product_feedback.sql` is authoritative, synchronized with
`drizzle/schema.ts`. Apply through `pnpm db:migrate`; no legacy migration generator.
The unique `(author_user_id, submission_id)` constraint arbitrates concurrent retries.
Insert and retry comparison share a READ COMMITTED transaction. The FK prevents
orphaned authors; account deletion cascades to feedback, while profile edits do not
change attribution. Account deletion currently has no self-service UI. Deleting
feedback also deletes its deduplication key; retry guarantees last while the row exists.

PUBLIC and existing anon/authenticated database roles receive no table privileges;
the server uses its existing trusted database connection. Do not grant this table to
browser/Data API roles. No message bodies or raw driver exceptions are logged.
Feedback is never included in directory or household data.

**Pre-launch decisions:** approve the retention duration, deletion request procedure,
backup handling, accountable operator and privacy notice. No automatic retention
period or indefinite-retention promise is introduced. Global admin review is a
**temporary pilot policy**, not a permanent equation of community administration
with the product team. Revisit reviewer authorization before broad rollout.

## Verification and parallel work

API boundary tests run in `pnpm test`. Signed-session PostgreSQL integration tests
use disposable `AUTH_TEST_DATABASE_URL` after the authoritative migrations, and run
in the database CI job. They cover actual resident/pending/unlinked/staff accounts,
concurrent retries, grant revocation, paging, FK/unique/check constraints and rollback.
No production data is needed. Migration lifecycle tests cover applying the new file.

Preflight found #58 changes the schema factory and migration infrastructure, but adds
no numbered SQL migration. This table uses the existing `pgTable` factory so that
schema selection can compose with #58; retain both changes when reconciling. The CI
integration-test command also overlaps #58: retain both test lists. #81/#82 do not
change schema or migrations. No other open PR used migration 0009 at preflight.
