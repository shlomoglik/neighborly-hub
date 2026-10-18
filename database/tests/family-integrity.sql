-- Constraint shape is checked without creating private resident fixtures.
BEGIN;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='invitations'::regclass AND conname='invitations_household_apartment_fk' AND contype='f') THEN
    RAISE EXCEPTION 'Missing household/apartment invitation FK';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='household_members'::regclass AND conname='household_members_creation_key_unique' AND contype='u') THEN
    RAISE EXCEPTION 'Missing child creation key uniqueness';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='household_members'::regclass AND conname='household_members_managed_child_not_representative' AND contype='c') THEN
    RAISE EXCEPTION 'Missing child representative constraint';
  END IF;
END $$;
ROLLBACK;
