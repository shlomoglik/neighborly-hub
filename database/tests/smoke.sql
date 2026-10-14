\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE
  project_id uuid;
  building_id uuid;
  floor_a uuid;
  floor_b uuid;
  apt_a uuid;
  apt_b uuid;
  company_id uuid;
  person_id uuid;
  household_id uuid;
BEGIN
  INSERT INTO projects(name) VALUES ('Test project') RETURNING id INTO project_id;
  INSERT INTO buildings(project_id, name) VALUES (project_id, 'Tower') RETURNING id INTO building_id;
  INSERT INTO floors(building_id, number) VALUES (building_id, 0) RETURNING id INTO floor_a;
  INSERT INTO floors(building_id, number) VALUES (building_id, 1) RETURNING id INTO floor_b;
  INSERT INTO apartments(building_id, floor_id, number) VALUES (building_id, floor_a, '1') RETURNING id INTO apt_a;
  INSERT INTO apartments(building_id, floor_id, number) VALUES (building_id, floor_b, '2') RETURNING id INTO apt_b;
  INSERT INTO parties(kind) VALUES ('organization') RETURNING id INTO company_id;
  INSERT INTO organizations(party_id, name, organization_kind) VALUES (company_id, 'Municipality', 'municipality');
  INSERT INTO apartment_ownerships(apartment_id, owner_party_id) VALUES (apt_a, company_id), (apt_b, company_id);
  INSERT INTO parties(kind) VALUES ('person') RETURNING id INTO person_id;
  INSERT INTO people(party_id, full_name) VALUES (person_id, 'Test Resident');
  INSERT INTO households(apartment_id, display_name) VALUES (apt_a, 'Family') RETURNING id INTO household_id;
  INSERT INTO household_members(household_id, person_id, is_contact_person) VALUES (household_id, person_id, true);
  IF (SELECT count(*) FROM apartment_ownerships WHERE owner_party_id = company_id) <> 2 THEN
    RAISE EXCEPTION 'Organization ownership across apartments failed';
  END IF;
  BEGIN
    INSERT INTO households(apartment_id, display_name) VALUES (apt_a, 'Duplicate household');
    RAISE EXCEPTION 'Expected unique active household constraint';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
  BEGIN
    INSERT INTO apartments(building_id, floor_id, number) VALUES (building_id, floor_b, '1');
    RAISE EXCEPTION 'Expected building-wide apartment uniqueness';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
  IF (SELECT count(*) FROM apartments) < 2 THEN
    RAISE EXCEPTION 'Apartment creation failed';
  END IF;
END $$;
ROLLBACK;
