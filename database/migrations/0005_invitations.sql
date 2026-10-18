BEGIN;
ALTER TABLE apartments ADD CONSTRAINT apartments_id_building_id_unique UNIQUE (id, building_id);
CREATE TABLE invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  building_id uuid,
  apartment_id uuid,
  kind text NOT NULL CHECK (kind IN ('resident','project_manager','building_manager')),
  recipient_email text,
  recipient_user_id uuid REFERENCES app_users(id) ON DELETE RESTRICT,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  consumed_at timestamptz,
  FOREIGN KEY (building_id,project_id) REFERENCES buildings(id,project_id) ON DELETE CASCADE,
  FOREIGN KEY (apartment_id,building_id) REFERENCES apartments(id,building_id) ON DELETE CASCADE,
  CHECK (expires_at > created_at),
  CHECK (recipient_email IS NULL OR (recipient_email = lower(trim(recipient_email)) AND length(recipient_email) BETWEEN 3 AND 254)),
  CHECK ((kind = 'resident' AND building_id IS NOT NULL) OR (kind = 'project_manager' AND building_id IS NULL AND apartment_id IS NULL) OR (kind = 'building_manager' AND building_id IS NOT NULL AND apartment_id IS NULL))
);
CREATE INDEX invitations_scope_idx ON invitations(project_id,building_id,created_at,id);
CREATE TABLE join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  apartment_id uuid REFERENCES apartments(id) ON DELETE CASCADE,
  full_name text,
  household_name text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by uuid REFERENCES app_users(id) ON DELETE RESTRICT,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (invitation_id,user_id),
  CHECK ((apartment_id IS NULL AND full_name IS NULL AND household_name IS NULL) OR (apartment_id IS NOT NULL AND full_name IS NOT NULL AND household_name IS NOT NULL AND length(trim(full_name)) BETWEEN 1 AND 200 AND length(trim(household_name)) BETWEEN 1 AND 200)),
  CHECK ((status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL) OR (status <> 'pending' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND reviewed_by <> user_id))
);
CREATE INDEX join_requests_user_idx ON join_requests(user_id,created_at,id);
CREATE INDEX join_requests_invitation_status_idx ON join_requests(invitation_id,status,created_at,id);
COMMIT;
