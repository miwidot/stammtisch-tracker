BEGIN;
SELECT plan(15);

CREATE TEMP TABLE fork_fixture (name text PRIMARY KEY, user_id uuid NOT NULL);
INSERT INTO fork_fixture VALUES
  ('solo', '00000000-0000-0000-0000-000000003001'), ('owner', '00000000-0000-0000-0000-000000003002'),
  ('member', '00000000-0000-0000-0000-000000003003'), ('leased', '00000000-0000-0000-0000-000000003004'),
  ('unknown', '00000000-0000-0000-0000-000000003099'), ('broken', '00000000-0000-0000-0000-000000003005');
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
SELECT ok(NOT has_function_privilege('authenticated', 'public.fork_delete_account(uuid)', 'EXECUTE'),
  'authenticated callers cannot delete accounts');

SELECT * FROM finish();
ROLLBACK;
