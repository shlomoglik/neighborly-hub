-- Enforce subtype integrity for party records at transaction commit.
-- These are deferred constraints so party + subtype can be inserted in either order.
BEGIN;

CREATE FUNCTION check_party_subtype(p_party_id uuid) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  party_kind text;
  person_count integer;
  org_count integer;
BEGIN
  SELECT kind INTO party_kind FROM parties WHERE id = p_party_id;
  IF NOT FOUND THEN
    RETURN; -- A deleted party does not need a subtype.
  END IF;
  SELECT count(*) INTO person_count FROM people WHERE party_id = p_party_id;
  SELECT count(*) INTO org_count FROM organizations WHERE party_id = p_party_id;
  IF (party_kind = 'person' AND person_count = 1 AND org_count = 0)
    OR (party_kind = 'organization' AND person_count = 0 AND org_count = 1) THEN
    RETURN;
  END IF;
  RAISE EXCEPTION 'Party % must have exactly one matching subtype', p_party_id
    USING ERRCODE = '23514';
END;
$$;

CREATE FUNCTION party_subtype_constraint_trigger() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'parties' THEN
    PERFORM check_party_subtype(NEW.id);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM check_party_subtype(OLD.party_id);
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM check_party_subtype(NEW.party_id);
  ELSE
    PERFORM check_party_subtype(OLD.party_id);
    IF OLD.party_id IS DISTINCT FROM NEW.party_id THEN
      PERFORM check_party_subtype(NEW.party_id);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER parties_subtype_check
  AFTER INSERT OR UPDATE OF kind ON parties
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION party_subtype_constraint_trigger();

CREATE CONSTRAINT TRIGGER people_subtype_check
  AFTER INSERT OR UPDATE OR DELETE ON people
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION party_subtype_constraint_trigger();

CREATE CONSTRAINT TRIGGER organizations_subtype_check
  AFTER INSERT OR UPDATE OR DELETE ON organizations
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION party_subtype_constraint_trigger();

COMMIT;
