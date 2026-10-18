# Global resident search

The authenticated `/search` page, accessible from the application header, searches names,
visible phone numbers and email addresses across all projects authorized by the current
session. Results include project, building, apartment and household context and a link to
the existing authorized household page. Submit a query of 2–100 characters; results use
stable, server-side pagination (20 resident/household identities per page).

`GET /api/search?query=...&page=1` derives identity exclusively from the session. It uses
the directory read model and its existing global-admin, project-manager, building-manager
and resident scopes. Every request reloads grants and evaluates project directory settings
in one repeatable-read transaction. Names, household names and apartment numbers retain
existing directory matching. Phone and email matching uses only contacts visible within
the matched project/building; hidden contacts cannot cause a result to appear. Phone
search also ignores spaces, punctuation and formatting; it does not infer country codes.
Children and inactive or unapproved households remain excluded. Accounts and staff-only
identities are not exposed through this resident directory search.

Search is case-insensitive, treats SQL wildcard characters literally and uses EXISTS for
contact matching so multiple matching contacts cannot duplicate identities or split pages.
Contacts returned in results use the same visibility predicate as matching. There is no
new migration, external search service or dependency.

Responses are private and uncached. The client uses the shared private-resource lifecycle
for cancellation, stale-response suppression, session expiry and revalidation. Changing
input immediately hides the previous results; queries and results are not stored in URLs
or browser storage. Hebrew, English and Russian strings use the existing dictionaries.

Validation covers anonymous/forged identities, input limits, uncached responses, explicit
submission and session expiry. The existing PostgreSQL directory integration suite also
exercises cross-project grants, hidden contact inference, normalized phones, email case,
children, pending and inactive households, revoked assignments, and global pagination.
