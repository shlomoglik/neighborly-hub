BEGIN;
-- Authorization depends on another table, so enforce it at write time rather than
-- embedding a mutable cross-table lookup in a CHECK constraint. Provenance remains
-- valid after a global role is removed.
ALTER TABLE user_person_links DROP CONSTRAINT user_person_links_no_self_verification;

CREATE FUNCTION enforce_identity_self_verification() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.user_id = NEW.verified_by THEN
    PERFORM 1 FROM global_roles
      WHERE user_id = NEW.user_id AND role = 'admin'
      FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Self-verification requires a global admin grant'
        USING ERRCODE = '23514', CONSTRAINT = 'user_person_links_no_self_verification';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER user_person_links_self_verification
BEFORE INSERT OR UPDATE OF user_id, verified_by ON user_person_links
FOR EACH ROW EXECUTE FUNCTION enforce_identity_self_verification();
COMMIT;
