BEGIN;
SELECT plan(6);

SELECT is((SELECT count(*)::integer FROM cron.job WHERE jobname = 'inactive-account-cleanup'), 0,
  'the inactive account cleanup job is not scheduled');
SELECT is((SELECT count(*)::integer FROM cron.job WHERE jobname = 'account-activity-snapshot'), 1,
  'activity snapshots stay scheduled (they delete nothing)');
SELECT is((SELECT count(*)::integer FROM cron.job WHERE jobname = 'account-deletion-retry'), 1,
  'retries of already requested deletions stay scheduled');
SELECT is((SELECT count(*)::integer FROM cron.job WHERE jobname = 'owner-only-team-cleanup'), 1,
  'owner-only team cleanup stays scheduled (teams only)');

-- Re-running the migration body must not fail when the job is already gone.
SELECT lives_ok($$
  DO $body$
  BEGIN
    IF to_regclass('cron.job') IS NOT NULL
      AND EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'inactive-account-cleanup') THEN
      PERFORM cron.unschedule('inactive-account-cleanup');
    END IF;
  END;
  $body$
$$, 'unscheduling twice is a no-op');

-- Scheduling it again and running the body removes it again.
SELECT cron.schedule('inactive-account-cleanup', '45 3 * * 0', 'SELECT 1');
DO $body$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'inactive-account-cleanup') THEN
    PERFORM cron.unschedule('inactive-account-cleanup');
  END IF;
END;
$body$;
SELECT is((SELECT count(*)::integer FROM cron.job WHERE jobname = 'inactive-account-cleanup'), 0,
  'the body removes a re-scheduled job');

SELECT * FROM finish();
ROLLBACK;
