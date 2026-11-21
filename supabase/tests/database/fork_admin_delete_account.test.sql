BEGIN;
SELECT plan(25);

CREATE TEMP TABLE fork_fixture (name text PRIMARY KEY, user_id uuid NOT NULL);
INSERT INTO fork_fixture VALUES
  ('solo', '00000000-0000-0000-0000-000000003001'), ('owner', '00000000-0000-0000-0000-000000003002'),
  ('member', '00000000-0000-0000-0000-000000003003'), ('leased', '00000000-0000-0000-0000-000000003004'),
  ('unknown', '00000000-0000-0000-0000-000000003099'), ('broken', '00000000-0000-0000-0000-000000003005'),
  ('stored', '00000000-0000-0000-0000-000000003006'),
  ('objowner', '00000000-0000-0000-0000-000000003007');
CREATE FUNCTION pg_temp.fork_user(p_name text) RETURNS uuid LANGUAGE sql AS $$
  SELECT user_id FROM fork_fixture WHERE name = p_name;
$$;
INSERT INTO auth.users(id, email)
SELECT user_id, name || '-fork@example.invalid' FROM fork_fixture WHERE name <> 'unknown';

INSERT INTO public.teams(id, name, join_code, owner_id, game_mode) VALUES
  ('00000000-0000-0000-0000-000000003101', 'Fork solo', 'fork-solo', pg_temp.fork_user('solo'), 'pvp'),
  ('00000000-0000-0000-0000-000000003102', 'Fork shared', 'fork-shared', pg_temp.fork_user('owner'), 'pvp');
INSERT INTO public.team_memberships(team_id, user_id, role, game_mode) VALUES
  ('00000000-0000-0000-0000-000000003101', pg_temp.fork_user('solo'), 'owner', 'pvp'),
  ('00000000-0000-0000-0000-000000003102', pg_temp.fork_user('owner'), 'owner', 'pvp'),
  ('00000000-0000-0000-0000-000000003102', pg_temp.fork_user('member'), 'member', 'pvp');
INSERT INTO public.team_events(team_id, event_type, initiated_by)
VALUES ('00000000-0000-0000-0000-000000003101', 'member_joined', pg_temp.fork_user('solo'));
INSERT INTO public.api_usage_daily(user_id, token_id, day, reads)
VALUES (pg_temp.fork_user('solo'), 'fork-test', current_date, 1);
-- trackerdev runs without the Storage service, so storage.* may not exist. Seed it only when present.
DO $seed$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets(id, name, owner_id)
    VALUES ('fork-test', 'fork-test', pg_temp.fork_user('stored')::text);
    IF to_regclass('storage.objects') IS NOT NULL THEN
      INSERT INTO storage.objects(bucket_id, name, owner_id)
      VALUES ('fork-test', 'fork-test/object.txt', pg_temp.fork_user('objowner')::text);
    END IF;
  END IF;
END
$seed$;
INSERT INTO public.account_deletion_jobs(user_id, status, attempts, max_attempts, claim_token, updated_at)
VALUES (pg_temp.fork_user('leased'), 'in_progress', 1, 5, '00000000-0000-0000-0000-000000003199', now());

SELECT is(public.fork_delete_account(pg_temp.fork_user('solo')), '{"deleted": true}'::jsonb,
  'deletes an account with an empty owned team');
SELECT is((SELECT count(*)::integer FROM auth.users WHERE id = pg_temp.fork_user('solo')), 0,
  'removes the Auth identity');
SELECT is((SELECT count(*)::integer FROM public.teams WHERE id = '00000000-0000-0000-0000-000000003101'), 0,
  'removes the empty owned team');
SELECT is((SELECT count(*)::integer FROM public.team_events WHERE initiated_by = pg_temp.fork_user('solo')), 0,
  'removes team events');
SELECT is((SELECT count(*)::integer FROM public.api_usage_daily WHERE user_id = pg_temp.fork_user('solo')), 0,
  'removes API accounting');
SELECT is((SELECT status FROM public.account_deletion_jobs WHERE user_id = pg_temp.fork_user('solo')),
  'completed', 'records a completed job');

SELECT is(public.fork_delete_account(pg_temp.fork_user('solo')),
  '{"deleted": false, "reason": "not_found"}'::jsonb, 'a repeated call is an idempotent no-op');
SELECT is(public.fork_delete_account(pg_temp.fork_user('unknown')),
  '{"deleted": false, "reason": "not_found"}'::jsonb, 'an unknown user is a no-op');

SELECT is(public.fork_delete_account(pg_temp.fork_user('owner')), '{"deleted": true}'::jsonb,
  'deletes the owner of a populated team');
SELECT is((SELECT owner_id FROM public.teams WHERE id = '00000000-0000-0000-0000-000000003102'),
  pg_temp.fork_user('member'), 'hands the populated team to the remaining member');

SELECT is((public.fork_delete_account(pg_temp.fork_user('leased')))->>'reason', 'claim_not_acquired',
  'does not steal a live deletion lease');
SELECT is((SELECT count(*)::integer FROM auth.users WHERE id = pg_temp.fork_user('leased')), 1,
  'leaves the leased account in place');

-- Storage owner paths: assertions run only where the Storage tables exist, otherwise they are skipped.
SELECT CASE WHEN to_regclass('storage.buckets') IS NOT NULL THEN
  (SELECT is((public.fork_delete_account(pg_temp.fork_user('stored')))->>'reason', 'storage_owner',
    'refuses an account that owns a Storage bucket'))
  ELSE skip('storage.buckets is absent on this stack', 1) END;
SELECT CASE WHEN to_regclass('storage.buckets') IS NOT NULL THEN
  (SELECT is((SELECT count(*)::integer FROM auth.users WHERE id = pg_temp.fork_user('stored')), 1,
    'leaves the Storage bucket owner in place'))
  ELSE skip('storage.buckets is absent on this stack', 1) END;
SELECT CASE WHEN to_regclass('storage.buckets') IS NOT NULL THEN
  (SELECT is((SELECT count(*)::integer FROM public.account_deletion_jobs WHERE user_id = pg_temp.fork_user('stored')), 0,
    'does not claim a job for the Storage bucket owner'))
  ELSE skip('storage.buckets is absent on this stack', 1) END;
SELECT CASE WHEN to_regclass('storage.objects') IS NOT NULL THEN
  (SELECT is((public.fork_delete_account(pg_temp.fork_user('objowner')))->>'reason', 'storage_owner',
    'refuses an account that owns a Storage object'))
  ELSE skip('storage.objects is absent on this stack', 1) END;

-- Absent-tables path: hide the Storage tables inside this transaction (rolled back at the end), or
-- rely on their real absence, and the deletion must still work instead of failing on a missing relation.
DO $hide$
BEGIN
  IF to_regclass('storage.objects') IS NOT NULL THEN
    ALTER TABLE storage.objects RENAME TO objects_hidden_by_test;
  END IF;
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    ALTER TABLE storage.buckets RENAME TO buckets_hidden_by_test;
  END IF;
END
$hide$;
SELECT is(to_regclass('storage.objects') IS NULL AND to_regclass('storage.buckets') IS NULL, true,
  'the Storage tables are absent for the next assertions');
SELECT is(public.fork_delete_account(pg_temp.fork_user('stored')), '{"deleted": true}'::jsonb,
  'deletes an account when the Storage tables do not exist');

CREATE FUNCTION pg_temp.block_fork_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.id = pg_temp.fork_user('broken') THEN RAISE EXCEPTION 'simulated auth delete failure'; END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER block_fork_delete BEFORE DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION pg_temp.block_fork_delete();
SELECT throws_ok($$SELECT public.fork_delete_account('00000000-0000-0000-0000-000000003005')$$,
  'P0001', 'simulated auth delete failure', 'a failing Auth delete aborts the call');
SELECT ok(NOT has_function_privilege('anon', 'public.fork_delete_account(uuid)', 'EXECUTE'),
  'anon cannot execute public.fork_delete_account(uuid)');
SELECT ok(NOT has_function_privilege('authenticated', 'public.fork_delete_account(uuid)', 'EXECUTE'),
  'authenticated cannot execute public.fork_delete_account(uuid)');
SELECT ok(has_function_privilege('service_role', 'public.fork_delete_account(uuid)', 'EXECUTE'),
  'service_role can execute public.fork_delete_account(uuid)');
SELECT ok(NOT has_function_privilege('anon', 'private.fork_delete_account(uuid)', 'EXECUTE'),
  'anon cannot execute private.fork_delete_account(uuid)');
SELECT ok(NOT has_function_privilege('authenticated', 'private.fork_delete_account(uuid)', 'EXECUTE'),
  'authenticated cannot execute private.fork_delete_account(uuid)');
SELECT ok(has_function_privilege('service_role', 'private.fork_delete_account(uuid)', 'EXECUTE'),
  'service_role can execute private.fork_delete_account(uuid)');

SELECT * FROM finish();
ROLLBACK;
