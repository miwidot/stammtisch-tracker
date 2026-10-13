import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
// Fork decision 2026-10-13 (FORK.md category B): this instance must never auto-delete accounts
// for inactivity. 20261013120000_fork_disable_inactive_account_cleanup.sql unschedules the
// upstream 'inactive-account-cleanup' pg_cron job that upstream's
// 20260930003202_automate_inactive_account_cleanup.sql installs. The risk is a FUTURE upstream
// merge re-introducing/re-scheduling that same job (directly, or by replacing the disable
// migration's effect with a new cron.schedule call) without anyone noticing at merge time.
//
// This guard reads every migration file's raw SQL (no database needed) and fails if any
// migration TIMESTAMPED AFTER our disable migration schedules the job again. It intentionally
// does not assert anything about migrations before ours (upstream's original schedule is
// expected and is exactly what we are disabling).
const DISABLE_MIGRATION = '20261013120000_fork_disable_inactive_account_cleanup.sql';
const JOB_NAME = 'inactive-account-cleanup';
const MIGRATIONS_DIR = resolve(process.cwd(), 'supabase/migrations');
const timestampOf = (filename: string): string => filename.split('_')[0] ?? '';
const schedulesJob = (sql: string): boolean =>
  // Matches cron.schedule('inactive-account-cleanup', ...) with either quote style, allowing
  // for whitespace/newlines between the call and the literal, the same way the other
  // idempotent unschedule-then-schedule migrations in this repo are written.
  new RegExp(`cron\\.schedule\\(\\s*['"]${JOB_NAME}['"]`).test(sql);
describe('fork: inactive-account-cleanup stays disabled', () => {
  it('our disable migration exists and actually unschedules the job', () => {
    const disableSql = readFileSync(resolve(MIGRATIONS_DIR, DISABLE_MIGRATION), 'utf8');
    expect(disableSql).toMatch(new RegExp(`cron\\.unschedule\\(\\s*['"]${JOB_NAME}['"]`));
    // Idempotent: must not error if the job was never scheduled (e.g. upstream's original
    // migration was never applied on this instance).
    expect(disableSql).toMatch(/IF EXISTS.*cron\.job.*jobname\s*=\s*'inactive-account-cleanup'/s);
  });
  it('no migration after ours re-schedules inactive-account-cleanup', () => {
    const disableTimestamp = timestampOf(DISABLE_MIGRATION);
    const files = readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith('.sql'));
    const offenders = files.filter((name) => {
      if (timestampOf(name) <= disableTimestamp) return false;
      const sql = readFileSync(resolve(MIGRATIONS_DIR, name), 'utf8');
      return schedulesJob(sql);
    });
    expect(offenders).toEqual([]);
  });
  it('upstream still schedules the job before our disable point (sanity check the regex)', () => {
    // If this ever stops matching, the regex above is broken and the guard is a false negative.
    const upstreamSql = readFileSync(
      resolve(MIGRATIONS_DIR, '20260930003202_automate_inactive_account_cleanup.sql'),
      'utf8'
    );
    expect(schedulesJob(upstreamSql)).toBe(true);
  });
});
