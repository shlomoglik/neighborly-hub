BEGIN;
CREATE TABLE community_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  question text NOT NULL,
  state text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  closed_at timestamptz,
  CONSTRAINT community_surveys_state_check CHECK (state IN ('draft', 'published', 'closed')),
  CONSTRAINT community_surveys_question_check CHECK (length(question) BETWEEN 1 AND 500 AND question ~ '[^[:space:]]'),
  CONSTRAINT community_surveys_timestamps_check CHECK (
    updated_at >= created_at AND (
      (state = 'draft' AND published_at IS NULL AND closed_at IS NULL) OR
      (state = 'published' AND published_at IS NOT NULL AND published_at >= created_at AND closed_at IS NULL) OR
      (state = 'closed' AND published_at IS NOT NULL AND closed_at IS NOT NULL AND closed_at >= published_at AND published_at >= created_at)
    )
  )
);
CREATE TABLE community_survey_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES community_surveys(id) ON DELETE CASCADE,
  label text NOT NULL,
  position integer NOT NULL,
  CONSTRAINT community_survey_options_label_check CHECK (length(label) BETWEEN 1 AND 200 AND label ~ '[^[:space:]]'),
  CONSTRAINT community_survey_options_position_check CHECK (position BETWEEN 1 AND 6),
  CONSTRAINT community_survey_options_position_unique UNIQUE (survey_id, position),
  CONSTRAINT community_survey_options_scope_unique UNIQUE (survey_id, id)
);
CREATE TABLE community_survey_responses (
  survey_id uuid NOT NULL REFERENCES community_surveys(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  option_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (survey_id, user_id),
  CONSTRAINT community_survey_responses_option_fk FOREIGN KEY (survey_id, option_id)
    REFERENCES community_survey_options(survey_id, id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX community_surveys_project_created_idx ON community_surveys(project_id, created_at DESC, id DESC);
CREATE INDEX community_surveys_creator_idx ON community_surveys(created_by);
CREATE INDEX community_survey_responses_option_idx ON community_survey_responses(survey_id, option_id);
CREATE INDEX community_survey_responses_user_idx ON community_survey_responses(user_id);

CREATE FUNCTION community_survey_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Project erasure is distinct from ordinary draft-only deletion.
    IF OLD.state <> 'draft' AND EXISTS (SELECT 1 FROM projects WHERE id = OLD.project_id) THEN
      RAISE EXCEPTION 'Only draft surveys may be deleted' USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    IF NEW.state <> 'draft' THEN
      RAISE EXCEPTION 'Surveys start as drafts' USING ERRCODE = '23514';
    END IF;
  ELSE
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.created_at IS DISTINCT FROM OLD.created_at
      OR (NEW.created_by IS DISTINCT FROM OLD.created_by AND NOT (
        NEW.created_by IS NULL AND NOT EXISTS (SELECT 1 FROM app_users WHERE id = OLD.created_by)
      )) THEN
      RAISE EXCEPTION 'Survey provenance is immutable' USING ERRCODE = '23514';
    END IF;
    IF (OLD.state <> 'draft' AND (
        NEW.question IS DISTINCT FROM OLD.question OR NEW.project_id IS DISTINCT FROM OLD.project_id
        OR NEW.published_at IS DISTINCT FROM OLD.published_at))
      OR (OLD.state = 'closed' AND NEW.closed_at IS DISTINCT FROM OLD.closed_at)
      OR NOT (NEW.state = OLD.state OR (OLD.state = 'draft' AND NEW.state = 'published')
        OR (OLD.state = 'published' AND NEW.state = 'closed')) THEN
      RAISE EXCEPTION 'Survey content or lifecycle is frozen' USING ERRCODE = '23514';
    END IF;
    NEW.updated_at := greatest(clock_timestamp(), OLD.updated_at);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER community_survey_guard BEFORE INSERT OR UPDATE OR DELETE ON community_surveys
  FOR EACH ROW EXECUTE FUNCTION community_survey_guard();

CREATE FUNCTION community_survey_option_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE target uuid; current_state text;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.survey_id IS DISTINCT FROM OLD.survey_id OR NEW.id IS DISTINCT FROM OLD.id) THEN
    RAISE EXCEPTION 'Option identity is immutable' USING ERRCODE = '23514';
  END IF;
  target := CASE WHEN TG_OP = 'DELETE' THEN OLD.survey_id ELSE NEW.survey_id END;
  -- A real parent write serializes option edits, including repeatable-read writers.
  UPDATE community_surveys SET updated_at = clock_timestamp() WHERE id = target RETURNING state INTO current_state;
  IF NOT FOUND AND TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF current_state IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'Options require a draft survey' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER community_survey_option_guard BEFORE INSERT OR UPDATE OR DELETE ON community_survey_options
  FOR EACH ROW EXECUTE FUNCTION community_survey_option_guard();

CREATE FUNCTION community_survey_option_count_check() RETURNS trigger
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE target uuid; option_count integer;
BEGIN
  IF TG_TABLE_NAME = 'community_surveys' THEN target := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN target := OLD.survey_id;
  ELSE target := NEW.survey_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM community_surveys WHERE id = target) THEN RETURN NULL; END IF;
  SELECT count(*) INTO option_count FROM community_survey_options WHERE survey_id = target;
  IF option_count NOT BETWEEN 2 AND 6 THEN
    RAISE EXCEPTION 'Surveys require two to six options' USING ERRCODE = '23514', CONSTRAINT = 'community_survey_option_count_check';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER community_survey_option_count_check AFTER INSERT ON community_surveys
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION community_survey_option_count_check();
CREATE CONSTRAINT TRIGGER community_survey_option_count_check AFTER INSERT OR UPDATE OR DELETE ON community_survey_options
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION community_survey_option_count_check();

CREATE FUNCTION community_survey_response_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE current_state text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Responses are immutable' USING ERRCODE = '23514';
  END IF;
  SELECT state INTO current_state FROM community_surveys WHERE id = NEW.survey_id FOR SHARE;
  IF current_state IS DISTINCT FROM 'published' THEN
    RAISE EXCEPTION 'Responses require a published survey' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER community_survey_response_guard BEFORE INSERT OR UPDATE ON community_survey_responses
  FOR EACH ROW EXECUTE FUNCTION community_survey_response_guard();

-- Backend only. No policies; browser/Data API roles receive neither grants nor rows.
ALTER TABLE community_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_survey_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_survey_responses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON community_surveys, community_survey_options, community_survey_responses FROM PUBLIC;
REVOKE ALL ON FUNCTION community_survey_guard(), community_survey_option_guard(),
  community_survey_option_count_check(), community_survey_response_guard() FROM PUBLIC;
DO $$
DECLARE api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON TABLE community_surveys, community_survey_options, community_survey_responses FROM %I', api_role);
      EXECUTE format('REVOKE ALL ON FUNCTION community_survey_guard(), community_survey_option_guard(), community_survey_option_count_check(), community_survey_response_guard() FROM %I', api_role);
    END IF;
  END LOOP;
END $$;
COMMIT;
