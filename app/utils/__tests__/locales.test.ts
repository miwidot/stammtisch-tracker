import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CATALOG_LANGUAGES } from '@/utils/catalogDatasets';
import { getLocaleNativeName, resolveAppLocale, SUPPORTED_LOCALES } from '@/utils/locales';
describe('fork locale list', () => {
  it('offers exactly German and English', () => {
    expect([...SUPPORTED_LOCALES]).toEqual(['de', 'en']);
  });
  it('derives the catalog language bundles from the same list', () => {
    expect([...CATALOG_LANGUAGES].sort()).toEqual(['de', 'en']);
  });
  it('derives the i18n module locales from SUPPORTED_LOCALES, so the switcher cannot list more', () => {
    const config = readFileSync('nuxt.config.ts', 'utf-8');
    expect(config).toMatch(/locales:\s*SUPPORTED_LOCALES\.map/);
  });
  it('shows native names for both offered languages', () => {
    expect(getLocaleNativeName('de')).toBe('Deutsch');
    expect(getLocaleNativeName('en')).toBe('English');
  });
});
describe('resolveAppLocale', () => {
  it.each([
    [null, 'de-DE', 'de'],
    [null, 'de', 'de'],
    [null, 'en-US', 'en'],
    [null, 'en_GB', 'en'],
    [null, 'fr-FR', 'de'],
    [null, 'ja-JP', 'de'],
    [null, 'uk-UA', 'de'],
    [undefined, undefined, 'de'],
    ['', '', 'de'],
    ['   ', '  ', 'de'],
    [null, null, 'de'],
    [null, 'garbage', 'de'],
    [null, '-', 'de'],
    [null, '__proto__', 'de'],
    [null, 'constructor', 'de'],
    ['en', 'de-DE', 'en'],
    ['de', 'en-US', 'de'],
    [' EN ', 'de-DE', 'de'],
    ['en-US', 'de-DE', 'en'],
    ['fr', 'en-US', 'en'],
    ['fr', 'fr-FR', 'de'],
    ['fr', null, 'de'],
    ['ja', 'de-DE', 'de'],
    ['<script>', 'en-US', 'en'],
  ])('resolves saved %j with browser %j to %s', (saved, browser, expected) => {
    expect(resolveAppLocale(saved as string | null, browser as string | null)).toBe(expected);
  });
  it('lets a saved supported choice win over the browser', () => {
    expect(resolveAppLocale('en', 'de-DE')).toBe('en');
    expect(resolveAppLocale('de', 'en-US')).toBe('de');
  });
});
