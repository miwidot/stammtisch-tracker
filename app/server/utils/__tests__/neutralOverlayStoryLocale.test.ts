import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { testOverlayEditions } from '@/server/utils/__tests__/overlayFixtures';
import { buildCatalogStrings, buildNeutralCatalog } from '@/server/utils/neutralCatalog';
import { parseNeutralOverlay } from '@/server/utils/neutralOverlay';
import { collectGameDataStrings, localizeGameData } from '@/utils/gameDataStrings';
import type { StoryChapter } from '@/types/tarkov';
const CHAPTER = 'falling-skies';
const OBJECTIVE = 'objective-1';
const UNLOCK = 'unlock-1';
const base = `@tt:overlay:/storyChapters/${CHAPTER}`;
// One entry per translatable text field the producer's locale schema allows for a chapter.
const FIELDS = {
  notes: { path: [`notes`], en: 'English note', de: 'Deutsche Notiz' },
  summary: {
    path: ['activation', 'summary'],
    en: 'English summary',
    de: 'Deutsche Zusammenfassung',
  },
  rewards: {
    path: ['rewards', 'description'],
    en: 'Unlocks achievement Pathfinder',
    de: 'Schaltet den Erfolg „Pathfinder“ frei',
  },
  objectiveNotes: {
    path: ['objectives', OBJECTIVE, 'notes'],
    en: 'English objective note',
    de: 'Deutsche Schrittnotiz',
  },
  unlockNote: {
    path: ['objectives', OBJECTIVE, 'unlocks', UNLOCK, 'note'],
    en: 'Unlocked after completing the Customs stage.',
    de: 'Wird nach Abschluss des Customs-Abschnitts freigeschaltet.',
  },
} as const;
const keyOf = (path: readonly string[]) => `${base}/${path.join('/')}`;
const sign = async (value: Record<string, unknown>, localeTargets: Record<string, string[]>) => {
  const unsigned = {
    schemaVersion: 1,
    editions: testOverlayEditions,
    storyChapters: {
      [CHAPTER]: {
        name: `${base}/name`,
        normalizedName: CHAPTER,
        wikiLink: 'https://example.com/falling-skies',
        order: 1,
        notes: keyOf(FIELDS.notes.path),
        activation: { summary: keyOf(FIELDS.summary.path) },
        rewards: { description: keyOf(FIELDS.rewards.path) },
        objectives: [
          {
            id: OBJECTIVE,
            type: 'main',
            description: `${base}/objectives/${OBJECTIVE}/description`,
            sourceQuestId: 'quest',
            notes: keyOf(FIELDS.objectiveNotes.path),
            unlocks: [
              {
                type: 'map',
                id: UNLOCK,
                name: `${base}/objectives/${OBJECTIVE}/unlocks/${UNLOCK}/name`,
                note: keyOf(FIELDS.unlockNote.path),
              },
            ],
          },
        ],
      },
    },
    $meta: { version: 'v1', generated: 'today' },
    $source: { version: 'v1', generated: 'today', sha256: 'source' },
    $strings: {
      en: {
        [`${base}/name`]: 'Falling Skies',
        [`${base}/objectives/${OBJECTIVE}/description`]: 'Talk',
        [`${base}/objectives/${OBJECTIVE}/unlocks/${UNLOCK}/name`]: 'Customs',
        ...Object.fromEntries(Object.values(FIELDS).map((f) => [keyOf(f.path), f.en])),
      },
      ...value,
    },
    $localeTargets: localeTargets,
  };
  const sha256 = createHash('sha256')
    .update(JSON.stringify(unsigned, null, 2))
    .digest('hex');
  return { ...unsigned, $meta: { ...unsigned.$meta, sha256 } };
};
const germanStrings = () => ({
  de: Object.fromEntries(Object.values(FIELDS).map((f) => [keyOf(f.path), f.de])),
});
const germanTargets = () =>
  Object.fromEntries(
    Object.values(FIELDS).map((f) => [keyOf(f.path), ['storyChapters', CHAPTER, ...f.path]])
  );
const localizedChapter = async (language: string): Promise<StoryChapter> => {
  const snapshot = await parseNeutralOverlay(await sign(germanStrings(), germanTargets()));
  const neutral = await buildNeutralCatalog('editions', 'regular', { snapshot });
  const table = await buildCatalogStrings(language, collectGameDataStrings(neutral.data), {
    snapshot,
  });
  const data = localizeGameData(neutral.data, table.data.strings) as {
    storyChapters: StoryChapter[];
  };
  return data.storyChapters[0]!;
};
describe('neutral overlay story chapter locale text', () => {
  it('serves every new German story field through the real catalog and bundle path', async () => {
    const chapter = await localizedChapter('de');
    expect(chapter.notes).toBe(FIELDS.notes.de);
    expect(chapter.activation?.summary).toBe(FIELDS.summary.de);
    expect(chapter.rewards?.description).toBe(FIELDS.rewards.de);
    const objective = Object.values(chapter.objectives ?? {})[0];
    expect(objective?.notes).toBe(FIELDS.objectiveNotes.de);
    expect(objective?.unlocks?.[0]?.note).toBe(FIELDS.unlockNote.de);
    // Names are not patched: the overlay name stays, the app resolves trader/map names by id.
    expect(objective?.unlocks?.[0]?.name).toBe('Customs');
  });
  it('keeps the English text for a language without a patch', async () => {
    const chapter = await localizedChapter('fr');
    expect(chapter.notes).toBe(FIELDS.notes.en);
    expect(chapter.activation?.summary).toBe(FIELDS.summary.en);
    expect(chapter.rewards?.description).toBe(FIELDS.rewards.en);
    const objective = Object.values(chapter.objectives ?? {})[0];
    expect(objective?.notes).toBe(FIELDS.objectiveNotes.en);
    expect(objective?.unlocks?.[0]?.note).toBe(FIELDS.unlockNote.en);
  });
  it('keeps the English fallback for a field whose German text is missing', async () => {
    const rewardsKey = keyOf(FIELDS.rewards.path);
    const without = <T>(record: Record<string, T>): Record<string, T> =>
      Object.fromEntries(Object.entries(record).filter(([key]) => key !== rewardsKey));
    const snapshot = await parseNeutralOverlay(
      await sign({ de: without(germanStrings().de) }, without(germanTargets()))
    );
    const neutral = await buildNeutralCatalog('editions', 'regular', { snapshot });
    const table = await buildCatalogStrings('de', collectGameDataStrings(neutral.data), {
      snapshot,
    });
    const chapter = (
      localizeGameData(neutral.data, table.data.strings) as { storyChapters: StoryChapter[] }
    ).storyChapters[0]!;
    expect(chapter.rewards?.description).toBe(FIELDS.rewards.en);
    expect(chapter.notes).toBe(FIELDS.notes.de);
  });
  it.each([
    ['wikiLink (a URL)', ['storyChapters', CHAPTER, 'wikiLink']],
    ['activation locations', ['storyChapters', CHAPTER, 'activation', 'locations']],
    [
      'activation location detail',
      ['storyChapters', CHAPTER, 'activation', 'locations', '0', 'detail'],
    ],
    ['reward items', ['storyChapters', CHAPTER, 'rewards', 'items']],
    ['chapter order', ['storyChapters', CHAPTER, 'order']],
    ['chapter id', ['storyChapters', CHAPTER, 'id']],
    ['unlock name', ['storyChapters', CHAPTER, 'objectives', OBJECTIVE, 'unlocks', UNLOCK, 'name']],
    ['unlock type', ['storyChapters', CHAPTER, 'objectives', OBJECTIVE, 'unlocks', UNLOCK, 'type']],
    ['unlock id', ['storyChapters', CHAPTER, 'objectives', OBJECTIVE, 'unlocks', UNLOCK, 'id']],
    ['objective count', ['storyChapters', CHAPTER, 'objectives', OBJECTIVE, 'count']],
    ['objective endingId', ['storyChapters', CHAPTER, 'objectives', OBJECTIVE, 'endingId']],
    [
      'unlock note one level too deep',
      ['storyChapters', CHAPTER, 'objectives', OBJECTIVE, 'unlocks', UNLOCK, 'note', 'x'],
    ],
    [
      'unlock note without its unlock id',
      ['storyChapters', CHAPTER, 'objectives', OBJECTIVE, 'unlocks', 'note'],
    ],
    ['notes under a task', ['tasks', 'task', 'objectives', OBJECTIVE, 'notes']],
    [
      'unlock note under a task',
      ['tasks', 'task', 'objectives', OBJECTIVE, 'unlocks', UNLOCK, 'note'],
    ],
    ['activation summary under a task', ['tasks', 'task', 'activation', 'summary']],
    ['rewards description under items', ['items', 'item', 'rewards', 'description']],
    ['prototype pollution via notes', ['storyChapters', '__proto__', 'notes']],
    [
      'prototype pollution via unlock id',
      ['storyChapters', CHAPTER, 'objectives', OBJECTIVE, 'unlocks', '__proto__', 'note'],
    ],
  ])('rejects a signed locale target for %s', async (_label, path) => {
    const key = `@tt:overlay:/${path.join('/')}`;
    const value = await sign({ de: { [key]: 'Geändert' } }, { [key]: [...path] });
    await expect(parseNeutralOverlay(value)).rejects.toThrow('Invalid neutral overlay strings');
  });
  it('rejects a target whose key does not match its path', async () => {
    const key = keyOf(FIELDS.notes.path);
    const value = await sign(
      { de: { [key]: 'Geändert' } },
      { [key]: ['storyChapters', 'other-chapter', 'notes'] }
    );
    await expect(parseNeutralOverlay(value)).rejects.toThrow('Invalid neutral overlay strings');
  });
  it('accepts exactly the five new story fields', async () => {
    await expect(
      parseNeutralOverlay(await sign(germanStrings(), germanTargets()))
    ).resolves.toMatchObject({
      localeTargets: germanTargets(),
    });
  });
});
