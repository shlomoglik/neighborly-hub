\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE
  valid_person uuid;
  valid_org uuid;
  orphan_party uuid;
  wrong_party uuid;
BEGIN
  INSERT INTO parties(kind) VALUES ('person') RETURNING id INTO valid_person;
  INSERT INTO people(party_id, full_name) VALUES (valid_person, 'Resident');
  INSERT INTO parties(kind) VALUES ('organization') RETURNING id INTO valid_org;
  INSERT INTO organizations(party_id, name) VALUES (valid_org, 'City');
  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;

  BEGIN
    INSERT INTO parties(kind) VALUES ('person') RETURNING id INTO orphan_party;
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'Missing person subtype was accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
  SET CONSTRAINTS ALL DEFERRED;

  BEGIN
    INSERT INTO parties(kind) VALUES ('organization') RETURNING id INTO wrong_party;
    INSERT INTO people(party_id, full_name) VALUES (wrong_party, 'Wrong subtype');
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'Mismatched party subtype was accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
  SET CONSTRAINTS ALL DEFERRED;
END $$;
ROLLBACK;
