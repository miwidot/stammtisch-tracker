// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  FORK_CHANGELOG_ENTRIES,
  forkChangelogItems,
  parseForkChangelogLocale,
} from '@/server/utils/forkChangelog';
const EMOJI = /\p{Extended_Pictographic}/u;
describe('fork changelog data', () => {
  it.each(['de', 'en'] as const)('%s items are complete and well formed', (locale) => {
    const items = forkChangelogItems(locale);
    expect(items).toHaveLength(FORK_CHANGELOG_ENTRIES.length);
    for (const item of items) {
      expect(item.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(new Date(`${item.date}T00:00:00Z`).getTime())).toBe(false);
      expect(item.label?.trim()).toBeTruthy();
      expect(item.bullets.length).toBeGreaterThan(0);
      for (const bullet of item.bullets) {
        expect(typeof bullet).toBe('string');
        expect(String(bullet).trim()).toBe(bullet);
        expect(String(bullet).length).toBeGreaterThan(10);
        expect(EMOJI.test(String(bullet))).toBe(false);
        expect(String(bullet)).not.toMatch(/claude|anthropic|\bAI\b|\bKI\b/i);
      }
    }
  });
  it('keeps both languages in lockstep, newest entry first', () => {
    for (const entry of FORK_CHANGELOG_ENTRIES) {
      expect(entry.bullets.de.length).toBe(entry.bullets.en.length);
    }
    const dates = FORK_CHANGELOG_ENTRIES.map((entry) => entry.date);
    expect([...dates].sort().reverse()).toEqual(dates);
  });
  it('names the reset settings and where to find the level now, in both languages', () => {
    const de = forkChangelogItems('de')
      .flatMap((item) => item.bullets.map(String))
      .join('\n');
    const en = forkChangelogItems('en')
      .flatMap((item) => item.bullets.map(String))
      .join('\n');
    expect(de).toContain('automatische Level-Berechnung');
    expect(de).toContain('Bereit zum Bauen zuerst sortieren');
    expect(de).toContain('Fertige Stationen einklappen');
    expect(de).toContain('Einstellungen > Fortschritt');
    expect(en).toContain('Automatic level calculation');
    expect(en).toContain('Sort ready to build first');
    expect(en).toContain('Collapse completed stations');
    expect(en).toContain('Settings > Progression');
  });
  it('tells players in the settings note that all progress stays intact, in both languages', () => {
    const [de] = forkChangelogItems('de');
    const [en] = forkChangelogItems('en');
    expect(de!.label).toBe('Bitte Einstellungen prüfen');
    expect(de!.bullets.map(String)).toContain(
      'Dein Quest- und Hideout-Fortschritt bleibt vollständig erhalten.'
    );
    expect(en!.label).toBe('Please check your settings');
    expect(en!.bullets.map(String)).toContain(
      'All your task, hideout and other progress stays fully intact.'
    );
  });
  it('returns fresh arrays so callers cannot mutate the source entries', () => {
    const first = forkChangelogItems('de');
    first[0]!.bullets.push('mutated');
    first[0]!.label = 'mutated';
    const second = forkChangelogItems('de');
    expect(second[0]!.bullets).not.toContain('mutated');
    expect(second[0]!.label).not.toBe('mutated');
  });
});
describe('parseForkChangelogLocale', () => {
  it.each([
    ['de', 'de'],
    ['DE', 'de'],
    [' de-DE ', 'de'],
    [['de', 'en'], 'de'],
    ['en', 'en'],
    ['fr', 'en'],
    ['', 'en'],
    [undefined, 'en'],
    [null, 'en'],
    [42, 'en'],
    [{ lang: 'de' }, 'en'],
    ['xde', 'en'],
    ['../de', 'en'],
    ['de'.repeat(5000), 'de'],
  ])('maps %j to %s', (input, expected) => {
    expect(parseForkChangelogLocale(input)).toBe(expected);
  });
});
