BEGIN;
ALTER TABLE invitations
  ADD COLUMN acceptance_policy text NOT NULL DEFAULT 'manual_review',
  ADD CONSTRAINT invitations_acceptance_policy_check CHECK (
    acceptance_policy = 'manual_review'
    OR (acceptance_policy = 'direct_acceptance' AND kind = 'resident' AND apartment_id IS NOT NULL
      AND (recipient_user_id IS NOT NULL OR recipient_email IS NOT NULL))
  );

-- The accepting account is join_requests.user_id. Keep issuer authorization
-- distinct from a manager's review decision.
ALTER TABLE join_requests
  ADD COLUMN authorized_by uuid REFERENCES app_users(id) ON DELETE RESTRICT,
  ADD COLUMN accepted_at timestamptz,
  DROP CONSTRAINT join_requests_review_audit_check,
  ADD CONSTRAINT join_requests_review_audit_check CHECK (
    (authorized_by IS NULL AND accepted_at IS NULL AND (
      (status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL)
      OR (status <> 'pending' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
    ))
    OR (status = 'approved' AND apartment_id IS NOT NULL
      AND authorized_by IS NOT NULL AND accepted_at IS NOT NULL
      AND reviewed_by IS NULL AND reviewed_at IS NULL)
  );
COMMIT;
