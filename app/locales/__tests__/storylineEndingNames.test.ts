/**
 * The four storyline endings are named through i18n keys looked up by ending id. This guards the
 * real locale files: a missing or untranslated name would silently show the English fallback.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  STORY_ENDING_IDS,
  isStoryEndingId,
  storyEndingFallbackLabel,
  storyEndingLabelKey,
} from '@/utils/storylineEndings';
type Tree = { [key: string]: string | Tree };
const localesDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => JSON.parse(readFileSync(join(localesDir, file), 'utf-8')) as Tree;
const lookup = (tree: Tree, path: string): string | Tree | undefined =>
  path.split('.').reduce<string | Tree | undefined>((node, part) => {
    if (typeof node !== 'object' || node === null) return undefined;
    return Object.hasOwn(node, part) ? node[part] : undefined;
  }, tree);
const en = read('en.json');
const de = read('de.json');
const deOverrides = read('de.overrides.json');
describe('storyline ending names', () => {
  it('knows exactly the four endings the overlay schema declares', () => {
    expect([...STORY_ENDING_IDS].sort()).toEqual([
      '68a6028ef4c23ebbbc49da4b',
      '68a6e8c834a37e244710d516',
      '68a6e8e4a8d0bee0b5324d96',
      '68a6e8f1a7455e5e23099ad8',
    ]);
  });
  it.each(STORY_ENDING_IDS)('has an English and a German name for ending %s', (id) => {
    const key = storyEndingLabelKey(id);
    expect(key).not.toBeNull();
    const english = lookup(en, key!);
    const german = lookup(deOverrides, key!);
    expect(english).toEqual(expect.any(String));
    expect(german).toEqual(expect.any(String));
    expect(german).not.toBe(english);
    // Crowdin does not own these keys, so the German text can only come from the overrides file.
    expect(lookup(de, key!)).toBeUndefined();
  });
  it('gives each ending its own key', () => {
    const keys = STORY_ENDING_IDS.map((id) => storyEndingLabelKey(id));
    expect(new Set(keys).size).toBe(STORY_ENDING_IDS.length);
  });
  it('builds the English fallback from the client name for known ids only', () => {
    expect(storyEndingFallbackLabel('68a6028ef4c23ebbbc49da4b')).toBe(
      'You Didnt Escape From Yourself'
    );
    expect(storyEndingFallbackLabel('not-an-ending')).toBe('Ending');
    expect(storyEndingFallbackLabel('__proto__')).toBe('Ending');
    expect(storyEndingFallbackLabel('not-an-ending', 'SomethingNew')).toBe('Something New');
  });
  it.each(['__proto__', 'constructor', 'toString', '', 'x', undefined, null, 7, {}])(
    'refuses %s as an ending id',
    (value) => {
      expect(isStoryEndingId(value)).toBe(false);
      expect(storyEndingLabelKey(value)).toBeNull();
    }
  );
});
