# Environment configuration and repository security

The Next.js UI preview currently uses mock data and requires **no** Supabase or database environment variables.

## Local environment files

- Put future local settings in `.env.local`; this file is ignored by Git.
- Commit only sanitized templates such as `.env.example`, never real credentials.
- Store production secrets in the deployment platform's secret manager.
- Do not prefix server-only secrets with `NEXT_PUBLIC_`, which exposes them to the browser.

## Historical configuration

An old `.env` file was tracked in repository history and removed from the current tree. Removing it does **not** erase past commits. Its entries were legacy Supabase project identifiers, URLs and publishable keys; publishable keys are not equivalent to private service-role credentials. Nevertheless, review the historical values and revoke/rotate anything that was mistakenly treated as confidential. Do not reuse old Supabase credentials for the independent backend.

If a real secret was ever committed, rotate it first; removing the file or rewriting Git history is not sufficient by itself. Coordinate history rewriting separately if necessary, especially if external tools still sync the repository.
