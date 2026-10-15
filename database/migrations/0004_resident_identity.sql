BEGIN;
-- Provision explicitly after an administrator verifies the resident's identity.
-- Neither OAuth email nor households.created_by establishes residency.
CREATE TABLE user_person_links (
  user_id uuid PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  person_id uuid NOT NULL UNIQUE REFERENCES people(party_id) ON DELETE CASCADE,
  verified_by uuid NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_person_links_no_self_verification CHECK (user_id <> verified_by)
);
COMMIT;
