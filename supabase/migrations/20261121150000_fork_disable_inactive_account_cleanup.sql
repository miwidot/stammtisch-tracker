-- Fork-only. Upstream's weekly `inactive-account-cleanup` job deletes accounts after six months
-- without activity. Here every tracker account belongs to a Stammtisch account, and the main site
-- keeps a mapping to it (QuestTrackerAccount). Deleting the tracker account behind its back
-- leaves that mapping dangling, so account deletion happens only through the main site
-- (POST /api/fork/account-delete, see FORK.md).
--
-- Kept on purpose:
--   account-activity-snapshot  records activity evidence only, deletes nothing.
--   account-deletion-retry     only finishes deletions that were already requested (by the main
--                              site through fork_delete_account) and failed midway.
--   owner-only-team-cleanup    removes expired owner-only teams, never accounts.
--
-- Idempotent: nothing happens when the job is not scheduled, or pg_cron is not installed.
DO $$
BEGIN
  IF to_regclass('cron.job') IS NOT NULL
    AND EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'inactive-account-cleanup') THEN
    PERFORM cron.unschedule('inactive-account-cleanup');
  END IF;
END;
$$;
