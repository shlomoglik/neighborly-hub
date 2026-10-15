-- Independent PostgreSQL baseline. Never run the legacy Supabase migration on this database.
-- PostgreSQL 15+; UUIDs use gen_random_uuid().
BEGIN;

CREATE TABLE app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city text,
  directory_visibility text NOT NULL DEFAULT 'community'
    CHECK (directory_visibility IN ('community', 'building')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE buildings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  UNIQUE (project_id, name),
  UNIQUE (id, project_id)
);
CREATE INDEX buildings_project_id_idx ON buildings(project_id);

CREATE TABLE floors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  number integer NOT NULL,
  UNIQUE (building_id, number),
  UNIQUE (id, building_id)
);
CREATE INDEX floors_building_id_idx ON floors(building_id);

CREATE TABLE apartments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL,
  floor_id uuid NOT NULL,
  number text NOT NULL CHECK (length(trim(number)) > 0),
  CONSTRAINT apartments_floor_building_fk FOREIGN KEY (floor_id, building_id)
    REFERENCES floors(id, building_id) ON DELETE CASCADE,
  UNIQUE (building_id, number)
);
CREATE INDEX apartments_floor_id_idx ON apartments(floor_id);

CREATE TABLE parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('person', 'organization')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE people (
  party_id uuid PRIMARY KEY REFERENCES parties(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  birth_date date,
  is_child boolean NOT NULL DEFAULT false
);
CREATE TABLE organizations (
  party_id uuid PRIMARY KEY REFERENCES parties(id) ON DELETE CASCADE,
  name text NOT NULL,
  organization_kind text NOT NULL DEFAULT 'other'
    CHECK (organization_kind IN ('company', 'developer', 'municipality', 'nonprofit', 'other')),
  registration_number text,
  registration_country text
);
CREATE UNIQUE INDEX organizations_registration_unique
  ON organizations(registration_country, registration_number)
  WHERE registration_country IS NOT NULL AND registration_number IS NOT NULL;

CREATE TABLE households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apartment_id uuid NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  approval_status text NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX households_one_active_per_apartment
  ON households(apartment_id) WHERE is_active;
CREATE INDEX households_apartment_id_idx ON households(apartment_id);

CREATE TABLE household_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES people(party_id) ON DELETE CASCADE,
  relation text,
  is_contact_person boolean NOT NULL DEFAULT false,
  contact_priority integer CHECK (contact_priority IS NULL OR contact_priority >= 0),
  UNIQUE (household_id, person_id)
);
CREATE INDEX household_members_person_id_idx ON household_members(person_id);

CREATE TABLE apartment_ownerships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apartment_id uuid NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
  owner_party_id uuid NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,
  ownership_share numeric(5,4) CHECK (ownership_share > 0 AND ownership_share <= 1),
  UNIQUE (apartment_id, owner_party_id)
);
CREATE INDEX apartment_ownerships_owner_idx ON apartment_ownerships(owner_party_id);

CREATE TABLE contact_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('phone', 'email')),
  value text NOT NULL CHECK (length(trim(value)) > 0),
  label text,
  visibility text NOT NULL DEFAULT 'managers'
    CHECK (visibility IN ('project', 'building', 'managers'))
);
CREATE INDEX contact_methods_party_id_idx ON contact_methods(party_id);

CREATE TABLE organization_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_party_id uuid NOT NULL REFERENCES organizations(party_id) ON DELETE CASCADE,
  person_party_id uuid NOT NULL REFERENCES people(party_id) ON DELETE CASCADE,
  role_label text,
  is_primary_contact boolean NOT NULL DEFAULT false,
  UNIQUE (organization_party_id, person_party_id)
);
CREATE INDEX organization_contacts_person_idx ON organization_contacts(person_party_id);

CREATE TABLE staff_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  building_id uuid,
  role text NOT NULL CHECK (role IN ('project_manager', 'building_manager')),
  CONSTRAINT staff_building_project_fk FOREIGN KEY (building_id, project_id)
    REFERENCES buildings(id, project_id) ON DELETE CASCADE,
  CHECK ((role = 'project_manager' AND building_id IS NULL)
      OR (role = 'building_manager' AND building_id IS NOT NULL)),
  UNIQUE NULLS NOT DISTINCT (user_id, project_id, building_id, role)
);
-- Required for the composite FK above.
CREATE INDEX staff_assignments_user_idx ON staff_assignments(user_id);

CREATE TABLE global_roles (
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin')),
  PRIMARY KEY (user_id, role)
);

COMMIT;
