BEGIN;
DO $$
DECLARE
  user_a uuid;
  user_b uuid;
BEGIN
  INSERT INTO app_users(email) VALUES ('auth-a@example.test') RETURNING id INTO user_a;
  INSERT INTO app_users(email) VALUES ('auth-b@example.test') RETURNING id INTO user_b;
  IF (SELECT email_verified FROM app_users WHERE id = user_a) THEN
    RAISE EXCEPTION 'New users must not be marked verified by default';
  END IF;
  INSERT INTO auth_accounts(user_id, provider_id, account_id) VALUES (user_a, 'google', 'stable-provider-subject');
  BEGIN
    INSERT INTO auth_accounts(user_id, provider_id, account_id) VALUES (user_b, 'google', 'stable-provider-subject');
    RAISE EXCEPTION 'Provider identity must not map to two local users';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  INSERT INTO auth_sessions(user_id, token, expires_at) VALUES (user_a, 'unique-test-session', now() + interval '1 day');
  BEGIN
    INSERT INTO auth_sessions(user_id, token, expires_at) VALUES (user_b, 'unique-test-session', now() + interval '1 day');
    RAISE EXCEPTION 'Session token must be unique';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO auth_sessions(user_id, token, expires_at) VALUES (gen_random_uuid(), 'orphan-test-session', now());
    RAISE EXCEPTION 'Session must reference a local user';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  DELETE FROM app_users WHERE id = user_a;
  IF EXISTS (SELECT FROM auth_accounts WHERE user_id = user_a) OR EXISTS (SELECT FROM auth_sessions WHERE user_id = user_a) THEN
    RAISE EXCEPTION 'Deleting a user must revoke sessions and linked accounts';
  END IF;
  IF EXISTS (SELECT FROM staff_assignments WHERE user_id = user_b) OR EXISTS (SELECT FROM global_roles WHERE user_id = user_b) THEN
    RAISE EXCEPTION 'Creating a login must not grant management roles';
  END IF;
END $$;
ROLLBACK;
