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
-- Keep audit completeness as a row-local CHECK, and authorize the self-review
-- exception against the current role and invitation kind at write time.
ALTER TABLE join_requests DROP CONSTRAINT join_requests_check1;
ALTER TABLE join_requests ADD CONSTRAINT join_requests_review_audit_check CHECK (
  (status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL)
  OR (status <> 'pending' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
);

CREATE FUNCTION enforce_join_request_self_review() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.user_id = NEW.reviewed_by THEN
    PERFORM 1 FROM global_roles gr JOIN invitations i ON i.id = NEW.invitation_id
      WHERE gr.user_id = NEW.user_id AND gr.role = 'admin'
        AND i.kind IN ('resident', 'project_manager', 'building_manager')
      FOR SHARE OF gr, i;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Self-review requires a global admin grant and an eligible invitation'
        USING ERRCODE = '23514', CONSTRAINT = 'join_requests_no_self_review';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER join_requests_self_review
BEFORE INSERT OR UPDATE OF user_id, reviewed_by, invitation_id, status ON join_requests
FOR EACH ROW EXECUTE FUNCTION enforce_join_request_self_review();
COMMIT;
