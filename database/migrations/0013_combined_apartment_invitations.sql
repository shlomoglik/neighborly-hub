BEGIN;
ALTER TABLE invitations
  ADD COLUMN staff_role text,
  ADD COLUMN staff_building_id uuid,
  ADD CONSTRAINT invitations_staff_building_project_fk
    FOREIGN KEY (staff_building_id, project_id) REFERENCES buildings(id, project_id) ON DELETE CASCADE,
  ADD CONSTRAINT invitations_staff_scope_check CHECK (
    (staff_role IS NULL AND staff_building_id IS NULL)
    OR (
      staff_role IS NOT NULL AND kind = 'resident' AND acceptance_policy = 'direct_acceptance'
      AND apartment_id IS NOT NULL AND recipient_email IS NOT NULL
      AND ((staff_role = 'project_manager' AND staff_building_id IS NULL)
        OR (staff_role = 'building_manager' AND staff_building_id IS NOT NULL))
    )
  );
CREATE INDEX invitations_staff_building_project_idx
  ON invitations(staff_building_id, project_id) WHERE staff_building_id IS NOT NULL;
COMMIT;
