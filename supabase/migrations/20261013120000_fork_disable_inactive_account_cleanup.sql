-- FORK DEVIATION (fork decision 2026-10-13, documented in FORK.md category B):
-- upstream's 20260930003202_automate_inactive_account_cleanup.sql schedules a weekly cron job
-- that deletes accounts after 6 months (supporters: 1 year) of inactivity, with no warning
-- e-mail (upstream has no such notification system -- see docs/account-retention.md). Our
-- community instance must never lose an account or its progress silently this way: unlike
-- upstream's hosted service, we do not run any user-facing warning/communication layer for it.
--
-- This migration keeps every OTHER part of the upstream retention feature: the activity
-- tracking tables/triggers (private.account_retention, retain_* triggers), the daily
-- `account-activity-snapshot` job (evidence only, never deletes), and the separate
-- `account-deletion-retry` job (20261006120000_retry_failed_account_deletions.sql, which only
-- finishes USER-REQUESTED deletions already queued in public.account_deletion_jobs -- it is not
-- reachable from the inactivity path, since private.delete_inactive_account() claims and deletes
-- in one atomic transaction and never leaves a pending/failed job row behind). Only the single
-- cron job that AUTOMATICALLY enqueues+deletes inactive accounts is removed.
--
-- private.run_inactive_account_cleanup() itself is intentionally left in place (dead code,
-- harmless) so a future upstream migration that only re-touches that function via
-- CREATE OR REPLACE does not conflict with this file.
--
-- docs/account-retention.md already documents unscheduling 'inactive-account-cleanup' as the
-- supported way to "pause" this feature -- this migration makes that pause permanent for our
-- instance instead of an ad-hoc operator action.
--
-- MERGE-TIME TRAP: a future upstream migration could re-create or re-schedule this job (directly,
-- or indirectly by editing private.run_inactive_account_cleanup() and re-issuing cron.schedule).
-- tests/fork-inactive-account-cleanup-guard.test.ts fails the suite if any migration timestamped
-- after this one schedules the 'inactive-account-cleanup' jobname again, so that merge PR cannot
-- land green without an explicit fork decision to re-apply this disable.
--
-- Idempotent: unschedule only if the job currently exists, so this migration is safe to run
-- whether or not 20260930003202 has ever been applied (cron.unschedule(text) raises when the
-- named job is missing, mirroring the unschedule-then-schedule guard used elsewhere in this repo).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'inactive-account-cleanup') THEN
    PERFORM cron.unschedule('inactive-account-cleanup');
  END IF;
END;
$$;
