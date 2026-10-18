BEGIN;
ALTER TABLE household_members
  ADD COLUMN is_managed_child boolean NOT NULL DEFAULT false,
  ADD COLUMN creation_key uuid,
  ADD CONSTRAINT household_members_managed_child_not_representative CHECK (NOT is_managed_child OR NOT is_contact_person),
  ADD CONSTRAINT household_members_creation_key_unique UNIQUE (household_id,creation_key);
ALTER TABLE households ADD CONSTRAINT households_id_apartment_unique UNIQUE (id,apartment_id);
ALTER TABLE invitations ADD COLUMN household_id uuid;
ALTER TABLE invitations ADD CONSTRAINT invitations_household_apartment_fk
  FOREIGN KEY (household_id,apartment_id) REFERENCES households(id,apartment_id) ON DELETE CASCADE;
-- Migration 0005 used unnamed checks. Replace only checks involving kind, independent of generated names.
DO $$ DECLARE constraint_name text; BEGIN
  FOR constraint_name IN SELECT conname FROM pg_constraint
    WHERE conrelid='invitations'::regclass AND contype='c'
      AND pg_get_constraintdef(oid) ~ '\mkind\M'
  LOOP EXECUTE format('ALTER TABLE invitations DROP CONSTRAINT %I',constraint_name); END LOOP;
END $$;
ALTER TABLE invitations
  ADD CONSTRAINT invitations_kind_check CHECK (kind IN ('resident','project_manager','building_manager','household_member')),
  ADD CONSTRAINT invitations_scope_check CHECK (
    (kind='resident' AND building_id IS NOT NULL AND household_id IS NULL)
    OR (kind='project_manager' AND building_id IS NULL AND apartment_id IS NULL AND household_id IS NULL)
    OR (kind='building_manager' AND building_id IS NOT NULL AND apartment_id IS NULL AND household_id IS NULL)
    OR (kind='household_member' AND building_id IS NOT NULL AND apartment_id IS NOT NULL AND household_id IS NOT NULL)
  );
-- Existing-household requests contain an adult name but no new household name.
DO $$ DECLARE constraint_name text; BEGIN
  FOR constraint_name IN SELECT conname FROM pg_constraint
    WHERE conrelid='join_requests'::regclass AND contype='c'
      AND pg_get_constraintdef(oid) ~ '\mhousehold_name\M'
  LOOP EXECUTE format('ALTER TABLE join_requests DROP CONSTRAINT %I',constraint_name); END LOOP;
END $$;
ALTER TABLE join_requests ADD CONSTRAINT join_requests_payload_check CHECK (
  (apartment_id IS NULL AND full_name IS NULL AND household_name IS NULL)
  OR (apartment_id IS NOT NULL AND full_name IS NOT NULL AND length(trim(full_name)) BETWEEN 1 AND 200
    AND (household_name IS NULL OR length(trim(household_name)) BETWEEN 1 AND 200))
);
CREATE INDEX invitations_household_idx ON invitations(household_id,created_at,id) WHERE household_id IS NOT NULL;
COMMIT;
