/**
 * The task card's "report data issue" entry stays removed.
 *
 * Upstream's version opens `trackerbot.nivmizz7.dev` — a maintainer's private
 * service — with the task, its objective ids, and the reader's player level and
 * game mode in the query string. We removed it: this instance should not send
 * anyone's data to a third party from a context menu, and the reader never sees
 * the URL before the tab opens.
 *
 * Both files it lived in are upstream files we now diverge from, so a merge can
 * quietly bring it back. That is what this guards.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
const appDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (entry === 'node_modules' || entry === '__tests__') return [];
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|vue)$/.test(entry) ? [full] : [];
  });
}
const files = sourceFiles(appDir);
const withRelative = files.map((file) => [file.slice(appDir.length + 1), file] as const);
describe('third-party data reporting', () => {
  it('has source files to scan', () => {
    expect(files.length).toBeGreaterThan(0);
  });
  it('reaches no external report endpoint from anywhere in the app', () => {
    const offenders = withRelative
      .filter(([, file]) => readFileSync(file, 'utf-8').includes('trackerbot.nivmizz7.dev'))
      .map(([relative]) => relative);
    expect(offenders).toEqual([]);
  });
  it('offers no report-data-issue action on the task card', () => {
    const taskCard = readFileSync(join(appDir, 'features', 'tasks', 'TaskCard.vue'), 'utf-8');
    expect(taskCard).not.toContain('report_data_issue');
    expect(taskCard).not.toContain('openTaskDataIssue');
  });
  it('does not expose the removed helpers from useTaskCardLinks', () => {
    const composable = readFileSync(join(appDir, 'composables', 'useTaskCardLinks.ts'), 'utf-8');
    expect(composable).not.toContain('openTaskDataIssue');
    expect(composable).not.toContain('getTaskDataIssueUrl');
  });
  it('sends no player level or game mode to an outside host', () => {
    // The removed URL carried these two verbatim. If a merge reintroduces the
    // feature under a different name, the labels are the tell.
    const offenders = withRelative
      .filter(([, file]) => {
        const source = readFileSync(file, 'utf-8');
        return source.includes('USER LEVEL:') || source.includes('USER MODE:');
      })
      .map(([relative]) => relative);
    expect(offenders).toEqual([]);
  });
});
