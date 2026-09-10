/**
 * Guards app/locales/de.overrides.json.
 *
 * The file is registered in nuxt.config.ts as the second entry of
 * `files: ['de.json', 'de.overrides.json']`, so its values shadow the
 * Crowdin-owned de.json. Nothing validates the key paths at build time:
 * a typo produces a key that silently overrides nothing, and the UI keeps
 * showing the untranslated string with no error anywhere.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
type Tree = { [key: string]: string | Tree };
// Read from disk rather than importing: the i18n build step pre-compiles
// message strings, so an import would hand us message ASTs instead of the
// text these assertions are about.
const localesDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => JSON.parse(readFileSync(join(localesDir, file), 'utf-8')) as Tree;
const deOverrides = read('de.overrides.json');
const de = read('de.json');
const en = read('en.json');
function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out.set(path, value);
    else for (const [k, v] of flatten(value, path)) out.set(k, v);
  }
  return out;
}
const overrides = flatten(deOverrides as Tree);
const source = flatten(en as Tree);
const crowdin = flatten(de as Tree);
describe('de.overrides.json', () => {
  it('overrides only keys that exist in the source locale', () => {
    const orphans = [...overrides.keys()].filter((key) => !source.has(key));
    expect(orphans).toEqual([]);
  });
  it('keeps every placeholder the source string declares', () => {
    const placeholders = (value: string) => (value.match(/\{[a-zA-Z]+\}/g) ?? []).sort();
    const broken = [...overrides].filter(
      ([key, value]) => placeholders(value).join() !== placeholders(source.get(key) ?? '').join()
    );
    expect(broken).toEqual([]);
  });
  // Identical in both languages on purpose: a brand name, and a badge that is
  // pure formatting. Everything else matching English means someone pasted the
  // source string in and the override does nothing.
  const IDENTICAL_BY_DESIGN = new Set([
    'navigation_drawer.brand_name',
    'page.tasks.questcard.trader_level_badge',
    // A trader's name. The override restores the English spelling on purpose —
    // see the Lightkeeper case below.
    'common.kappa_lightkeeper',
  ]);
  it('carries no entry that merely repeats the English source', () => {
    const untranslated = [...overrides]
      .filter(([key]) => !IDENTICAL_BY_DESIGN.has(key))
      .filter(([key, value]) => value === source.get(key));
    expect(untranslated).toEqual([]);
  });
  it('keeps the by-design exceptions honest', () => {
    const stale = [...IDENTICAL_BY_DESIGN].filter((key) => !overrides.has(key));
    expect(stale, 'exception listed for a key the override file no longer has').toEqual([]);
  });
});
describe('reported translation defects', () => {
  // "Reset Failed" is an imperative — reset the failed status. The Crowdin
  // export reads it as a past-tense error report ("resetting has failed"),
  // which is a different statement on a button.
  it('renders common.reset_failed as a command, not an error report', () => {
    expect(crowdin.get('common.reset_failed')).toBe('Zurücksetzen fehlgeschlagen');
    expect(overrides.get('common.reset_failed')).toBe('Fehlgeschlagen zurücksetzen');
  });
  // Same button on the Kappa page, left in English rather than mistranslated.
  it('translates the Kappa row action that states the same thing', () => {
    expect(source.get('page.kappa.row.action_reset_failed')).toBe('Reset failed');
    expect(overrides.get('page.kappa.row.action_reset_failed')).toBe(
      overrides.get('common.reset_failed')
    );
  });
  // The task card's action buttons are commands. The Crowdin export renders
  // two of them as something else: a noun ("Fehler" = an error) and a stray
  // adverb reading ("Vollständig markieren" = mark completely).
  it('renders the task card actions as commands', () => {
    expect(crowdin.get('common.fail')).toBe('Fehler');
    expect(overrides.get('common.fail')).toBe('Fehlgeschlagen');
    expect(crowdin.get('common.mark_complete')).toBe('Vollständig markieren');
    expect(overrides.get('common.mark_complete')).toBe('Als abgeschlossen markieren');
  });
  // Trader names are proper nouns. BSG's own German bundle leaves Lightkeeper
  // untranslated (only Jaeger and BTR Driver get German forms), and every other
  // string in this UI writes "Lightkeeper" too. The Crowdin export invented
  // "Lichthalter" for the menu entry alone, so the one place a reader meets the
  // trader in navigation disagreed with everywhere else they meet him.
  it('keeps the Lightkeeper trader name in the menu entry', () => {
    expect(crowdin.get('common.kappa_lightkeeper')).toBe('Kappa & Lichthalter');
    expect(overrides.get('common.kappa_lightkeeper')).toBe('Kappa & Lightkeeper');
  });
  // The sibling strings that were never renamed — these are what the override
  // above realigns with.
  it('matches the Lightkeeper spelling the rest of the German UI uses', () => {
    expect(crowdin.get('page.tasks.settings.filters.lightkeeper_required')).toContain(
      'Lightkeeper'
    );
    expect(crowdin.get('page.tasks.questcard.lightkeeper_tooltip')).toContain('Lightkeeper');
  });
  // The sibling buttons upstream already got right — these anchor the pattern
  // the two corrections above follow.
  it('matches the phrasing of the buttons that were already correct', () => {
    expect(crowdin.get('page.tasks.questcard.available_button')).toBe('Als verfügbar markieren');
    expect(crowdin.get('page.tasks.questcard.mark_failed')).toBe('Als fehlgeschlagen markieren');
  });
  it('translates the accepted-items popover', () => {
    for (const key of ['any_of_items', 'any_of_items_short', 'view_accepted_items']) {
      const path = `needed_items.${key}`;
      expect(crowdin.get(path), `${path} is expected to be untranslated upstream`).toBe(
        source.get(path)
      );
      expect(overrides.get(path)).toBeDefined();
    }
  });
});
