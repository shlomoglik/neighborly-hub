BEGIN;
CREATE TABLE product_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  submission_id uuid NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_feedback_author_submission_unique UNIQUE (author_user_id, submission_id),
  CONSTRAINT product_feedback_message_check CHECK (length(message) BETWEEN 1 AND 2000 AND message ~ '[^[:space:]]')
);
CREATE INDEX product_feedback_created_idx ON product_feedback(created_at DESC, id DESC);
-- Product research is server-only, including when a host grants default Data API privileges.
REVOKE ALL ON product_feedback FROM PUBLIC;
DO $$
DECLARE api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON TABLE product_feedback FROM %I', api_role);
    END IF;
  END LOOP;
END $$;
COMMIT;
