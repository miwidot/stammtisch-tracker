import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoryChapter, StoryChapterEnding } from '@/types/tarkov';
const objectiveCompletionState = new Set<string>();
const chapterCompletionState = new Set<string>();
// Real client/ending_list ids: the only ones the app recognises as endings.
const HUMANITY_ENDING_ID = '68a6e8f1a7455e5e23099ad8';
const SURVIVED_ENDING_ID = '68a6e8c834a37e244710d516';
const FALLEN_ENDING_ID = '68a6e8e4a8d0bee0b5324d96';
const STORY_CHAPTERS: StoryChapter[] = [
  {
    id: 'chapter-1',
    name: 'Chapter 1',
    normalizedName: 'chapter-1',
    wikiLink: 'https://example.com/chapter-1',
    order: 1,
    autoStart: false,
    chapterRequirements: [{ id: 'req-1', name: 'Finish Intro' }],
    mapUnlocks: [
      { id: 'map-1', name: 'Route B Objective' },
      { id: 'map-2', name: 'Side Objective' },
    ],
    traderUnlocks: [{ id: 'trader-1', name: 'Peacekeeper' }],
    rewards: {
      description: 'Chapter completion package',
    },
    objectives: {
      'obj-a': {
        id: 'obj-a',
        order: 1,
        type: 'main',
        description: 'Route A Objective',
        notes: 'Savior ending - cooperate fully with Kerman',
        endingId: HUMANITY_ENDING_ID,
        mutuallyExclusiveWith: ['obj-b'],
      },
      'obj-b': {
        id: 'obj-b',
        order: 2,
        type: 'main',
        description: 'Route B Objective',
        notes: 'Fallen ending - keep the evidence',
        endingId: FALLEN_ENDING_ID,
        mutuallyExclusiveWith: ['obj-a'],
      },
      'obj-c': {
        id: 'obj-c',
        order: 3,
        type: 'optional',
        description: 'Side Objective',
      },
      'obj-d': {
        id: 'obj-d',
        order: 4,
        type: 'optional',
        description: 'Unknown Link Objective',
        mutuallyExclusiveWith: ['missing-objective'],
      },
    },
  },
];
const DECLARED_ENDING_CHAPTER: StoryChapter = {
  id: 'the-ticket',
  name: 'The Ticket',
  normalizedName: 'the-ticket',
  wikiLink: 'https://example.com/the-ticket',
  order: 2,
  chapterQuestId: '67bc646c6e34475fea09d2a5',
  referenceCoverage: {
    referencedSubquests: 88,
    resolvedSubquests: 35,
    missingObjectiveTexts: 2,
    partial: true,
  },
  endings: [
    {
      id: 'ending-resolved',
      systemName: 'EscapedFromTarkovForHumanity',
      gateQuestId: 'quest-gate',
      objectiveCount: 2,
      resolvedInReference: true,
    },
    {
      id: 'ending-pending',
      systemName: 'YouDidntEscapeFromYourself',
      gateQuestId: 'quest-pending',
      objectiveCount: 0,
      resolvedInReference: false,
    },
  ],
  mutuallyExclusiveQuestPairs: [['quest-keep', 'quest-hand-over']],
  objectives: {
    'obj-gate-1': {
      id: 'obj-gate-1',
      order: 1,
      type: 'main',
      description: 'Arrive at the terminal',
      sourceQuestId: 'quest-gate',
      endingId: 'ending-resolved',
    },
    'obj-gate-2': {
      id: 'obj-gate-2',
      order: 2,
      type: 'optional',
      description: 'Bring the secure case',
      sourceQuestId: 'quest-gate',
      endingId: 'ending-resolved',
    },
    'obj-keep': {
      id: 'obj-keep',
      order: 3,
      type: 'main',
      description: 'Keep the case',
      sourceQuestId: 'quest-keep',
    },
    'obj-hand': {
      id: 'obj-hand',
      order: 4,
      type: 'main',
      description: 'Hand the case over',
      sourceQuestId: 'quest-hand-over',
    },
  },
};
const loadComposable = async (
  storyChapters: StoryChapter[] = STORY_CHAPTERS,
  options: Parameters<
    typeof import('@/composables/useStorylineChapters').useStorylineChapters
  >[0] = {},
  metadata: { maps?: unknown; traders?: unknown } = {}
) => {
  vi.resetModules();
  vi.doMock('@/stores/useMetadata', () => ({
    useMetadataStore: () => ({
      storyChapters,
      storyChaptersGameMode: 'pvp',
      ...metadata,
    }),
  }));
  vi.doMock('@/stores/useTarkov', () => ({
    useTarkovStore: () => ({
      isStoryChapterComplete: (chapterId: string) => chapterCompletionState.has(chapterId),
      isStoryObjectiveComplete: (chapterId: string, objectiveId: string) =>
        objectiveCompletionState.has(`${chapterId}:${objectiveId}`),
    }),
  }));
  const { useStorylineChapters } = await import('@/composables/useStorylineChapters');
  return useStorylineChapters(options);
};
const requireDefined = <T>(value: T | null | undefined, message: string): T => {
  expect(value, message).toBeDefined();
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
};
describe('useStorylineChapters', () => {
  it('counts an automatic step without completing its independent dialogue or chapter', async () => {
    const chapter: StoryChapter = {
      id: 'tour',
      name: 'Tour',
      normalizedName: 'tour',
      order: 1,
      wikiLink: '',
      objectives: {
        escape: {
          id: 'escape',
          type: 'main',
          order: 1,
          description: 'Escape',
          completionPolicy: 'tutorial',
        },
        therapist: { id: 'therapist', type: 'main', order: 2, description: 'Talk' },
      },
    };
    const { normalizedChapters } = await loadComposable([chapter], {
      isObjectiveComplete: () => false,
      isChapterComplete: () => false,
    });
    expect(normalizedChapters.value[0]?.mainObjectiveCompleted).toBe(1);
    expect(normalizedChapters.value[0]?.mainObjectiveTotal).toBe(2);
    expect(normalizedChapters.value[0]?.complete).toBe(false);
    expect(normalizedChapters.value[0]?.objectives.map((objective) => objective.complete)).toEqual([
      true,
      false,
    ]);
    expect(objectiveCompletionState.size).toBe(0);
    expect(chapterCompletionState.size).toBe(0);
  });
  beforeEach(() => {
    objectiveCompletionState.clear();
    chapterCompletionState.clear();
  });
  it('derives chosen, blocked, and open storyline route states', async () => {
    objectiveCompletionState.add('chapter-1:obj-b');
    const { normalizedChapters } = await loadComposable();
    const chapter = requireDefined(
      normalizedChapters.value[0],
      'Expected first normalized chapter'
    );
    expect(chapter.requirements).toEqual([{ id: 'req-1', label: 'Finish Intro' }]);
    const objectiveA = requireDefined(
      chapter.objectives.find((objective) => objective.id === 'obj-a'),
      'Expected obj-a objective'
    );
    const objectiveB = requireDefined(
      chapter.objectives.find((objective) => objective.id === 'obj-b'),
      'Expected obj-b objective'
    );
    const objectiveC = requireDefined(
      chapter.objectives.find((objective) => objective.id === 'obj-c'),
      'Expected obj-c objective'
    );
    expect(objectiveA.routeState).toBe('blocked');
    expect(objectiveA.routeAlternatives).toEqual([
      { id: 'obj-b', label: 'Route B Objective', complete: true },
    ]);
    expect(objectiveA.routeBlockingAlternatives).toEqual([
      { id: 'obj-b', label: 'Route B Objective', complete: true },
    ]);
    expect(objectiveB.routeState).toBe('chosen');
    expect(objectiveC.routeState).toBe('open');
    expect(chapter.mainObjectiveCompleted).toBe(1);
    expect(chapter.mainObjectiveTotal).toBe(2);
    expect(chapter.mainRouteChoices).toHaveLength(1);
    expect(chapter.mainRouteChoices[0]?.objectives.map((objective) => objective.id)).toEqual([
      'obj-a',
      'obj-b',
    ]);
    expect(chapter.endings).toEqual([
      {
        id: 'obj-a-ending',
        label: 'Escaped From Tarkov For Humanity',
        labelKey: 'page.storyline.ending_names.escaped_for_humanity',
        objectiveId: 'obj-a',
        objectiveLabel: 'Route A Objective',
        routeBlockingAlternatives: [{ id: 'obj-b', label: 'Route B Objective', complete: true }],
        routeChoiceIndex: 1,
        routeState: 'blocked',
      },
      {
        id: 'obj-b-ending',
        label: 'Escaped From Tarkov To Fall In The Darkness',
        labelKey: 'page.storyline.ending_names.escaped_to_fall_in_the_darkness',
        objectiveId: 'obj-b',
        objectiveLabel: 'Route B Objective',
        routeBlockingAlternatives: [],
        routeChoiceIndex: 1,
        routeState: 'chosen',
      },
    ]);
    expect(objectiveA.unlocks).toEqual([]);
    expect(objectiveB.unlocks).toEqual([]);
    expect(objectiveC.unlocks).toEqual([]);
    expect(objectiveA.hasEstimatedUnlocks).toBe(false);
    expect(objectiveB.hasEstimatedUnlocks).toBe(false);
    expect(objectiveC.hasEstimatedUnlocks).toBe(false);
    expect(chapter.chapterUnlocks.map((unlock) => unlock.label)).toEqual([
      'Route B Objective',
      'Side Objective',
      'Peacekeeper',
      'Chapter completion package',
    ]);
    expect(chapter.mainLinearObjectives).toEqual([]);
    expect(chapter.optionalRouteChoices).toEqual([]);
    expect(chapter.optionalLinearObjectives.map((objective) => objective.id)).toEqual([
      'obj-c',
      'obj-d',
    ]);
  });
  it('preserves explicit stage unlocks through projection instead of guessing chapter reward timing', async () => {
    const { projectStoryChapters } = await import('@/server/utils/overlayProjectors');
    const chapters = projectStoryChapters(
      {
        storyChapters: {
          tour: {
            name: 'Tour',
            order: 1,
            traderUnlocks: [{ id: '5935c25fb3acc3127c3d8cd9', name: 'Peacekeeper' }],
            mapUnlocks: [{ id: '5704e554d2720bac5b8b456e', name: 'Shoreline' }],
            rewards: { description: 'Pathfinder achievement' },
            objectives: [
              { id: 'escape', type: 'main', description: 'Escape Ground Zero' },
              { id: 'talk', type: 'main', description: 'Talk to Skier' },
              { id: 'kills', type: 'main', description: 'Eliminate any 3 targets on Woods' },
              {
                id: 'woods',
                type: 'main',
                description: 'Survive and extract from Woods or visit Woods 3 times',
                sourceQuestId: '6895bf915bcf5c38e90b83d8',
                unlocks: [
                  {
                    type: 'trader',
                    id: '5935c25fb3acc3127c3d8cd9',
                    name: 'Peacekeeper',
                    note: 'Complete the Skier / Woods stage.',
                  },
                  { type: 'map', id: '5704e554d2720bac5b8b456e', name: 'Shoreline' },
                ],
              },
            ],
          },
        },
      },
      'regular',
      'en'
    );
    const { normalizedChapters } = await loadComposable(chapters);
    const chapter = normalizedChapters.value[0]!;
    expect(chapter.objectives.slice(0, 3).map((o) => o.unlocks)).toEqual([[], [], []]);
    expect(chapter.objectives[3]?.unlocks).toEqual([
      {
        estimated: false,
        type: 'trader',
        id: '5935c25fb3acc3127c3d8cd9',
        label: 'Peacekeeper',
        note: 'Complete the Skier / Woods stage.',
      },
      { estimated: false, type: 'map', id: '5704e554d2720bac5b8b456e', label: 'Shoreline' },
    ]);
    expect(chapter.chapterUnlocks).toEqual([
      { estimated: false, type: 'reward', id: 'tour-reward-1', label: 'Pathfinder achievement' },
    ]);
    expect(chapter.objectives.every((o) => !o.hasEstimatedUnlocks)).toBe(true);
  });
  it.each([
    ['map' as const, 'map-1', 'Route B Objective'],
    ['trader' as const, 'trader-1', 'Peacekeeper'],
    ['map' as const, 'map-1', ' Route B Objective '],
    ['trader' as const, 'trader-1', 'Peacekeeper '],
  ])(
    'deduplicates an explicit %s unlock with no source ID against the chapter summary',
    async (type, id, name) => {
      const chapter = structuredClone(STORY_CHAPTERS[0]!);
      chapter.objectives!['obj-a']!.unlocks = [{ type, name }];
      const { normalizedChapters } = await loadComposable([chapter]);
      const view = normalizedChapters.value[0]!;
      expect(view.objectives[0]?.unlocks).toEqual([{ estimated: false, type, id, label: name }]);
      expect(view.chapterUnlocks.some((u) => u.type === type && u.id === id)).toBe(false);
    }
  );
  it.each([
    ['map' as const, 'mapUnlocks' as const, 7],
    ['trader' as const, 'traderUnlocks' as const, null],
  ])(
    'ignores a cached %s reference with a non-string name when matching unlocks',
    async (type, field, name) => {
      const chapter = structuredClone(STORY_CHAPTERS[0]!);
      chapter[field] = [
        { id: 'malformed-reference', name },
      ] as unknown as StoryChapter[typeof field];
      chapter.objectives!['obj-a']!.unlocks = [{ type, name: 'Valid unlock' }];
      const { normalizedChapters } = await loadComposable([chapter]);
      expect(normalizedChapters.value[0]?.objectives[0]?.unlocks).toEqual([
        { estimated: false, type, id: 'obj-a-unlock-1', label: 'Valid unlock' },
      ]);
    }
  );
  it('keeps unplaced unlocks at chapter level even when objective text mentions the trader', async () => {
    const chapter = structuredClone(STORY_CHAPTERS[0]!);
    chapter.objectives!['obj-a']!.description = 'Talk to Peacekeeper';
    const { normalizedChapters } = await loadComposable([chapter]);
    const view = normalizedChapters.value[0]!;
    expect(view.objectives.every((o) => o.unlocks.length === 0)).toBe(true);
    expect(view.chapterUnlocks.map((u) => u.label)).toEqual([
      'Route B Objective',
      'Side Objective',
      'Peacekeeper',
      'Chapter completion package',
    ]);
  });
  it('ignores missing mutually exclusive links when deriving route alternatives', async () => {
    const { normalizedChapters } = await loadComposable();
    const chapter = requireDefined(
      normalizedChapters.value[0],
      'Expected first normalized chapter'
    );
    const objectiveD = requireDefined(
      chapter.objectives.find((objective) => objective.id === 'obj-d'),
      'Expected obj-d objective'
    );
    expect(objectiveD.routeAlternatives).toEqual([]);
    expect(objectiveD.routeBlockingAlternatives).toEqual([]);
    expect(objectiveD.routeState).toBe('open');
    expect(chapter.endings.map((ending) => ending.objectiveId)).toEqual(['obj-a', 'obj-b']);
  });
  it('does not derive endings from note or objective wording', async () => {
    const chapters = JSON.parse(JSON.stringify(STORY_CHAPTERS)) as StoryChapter[];
    const chapter = chapters[0];
    if (!chapter) {
      throw new Error('Missing storyline chapter fixture');
    }
    chapter.objectives = chapter.objectives ?? {};
    chapter.objectives['obj-e'] = {
      description: 'Savior ending',
      id: 'obj-e',
      mutuallyExclusiveWith: ['obj-f'],
      notes: 'Kerman Route - Fallen ending',
      order: 5,
      type: 'optional',
    };
    chapter.objectives['obj-f'] = {
      description: 'Kerman Route Alternative',
      id: 'obj-f',
      order: 6,
      type: 'optional',
    };
    const { normalizedChapters } = await loadComposable(chapters);
    const normalizedChapter = requireDefined(
      normalizedChapters.value[0],
      'Expected first normalized chapter'
    );
    expect(normalizedChapter.optionalRouteChoices).toHaveLength(1);
    // Only the two tagged objectives are endings; obj-e reads like one but carries no endingId.
    expect(normalizedChapter.endings.map((ending) => ending.objectiveId)).toEqual([
      'obj-a',
      'obj-b',
    ]);
  });
  describe('ending detection with translated objective text', () => {
    // The overlay serves German objective text, so wording like "ending" never appears. Endings
    // must come from the endingId tag, which is the same in every language.
    const routeChapter = (text: {
      a: { description: string; notes: string };
      b: { description: string; notes: string };
    }): StoryChapter => ({
      id: 'the-ticket-routes',
      name: 'The Ticket',
      normalizedName: 'the-ticket-routes',
      wikiLink: '',
      order: 2,
      objectives: {
        'route-a': {
          id: 'route-a',
          order: 1,
          type: 'main',
          ...text.a,
          endingId: HUMANITY_ENDING_ID,
          mutuallyExclusiveWith: ['route-b'],
        },
        'route-b': {
          id: 'route-b',
          order: 2,
          type: 'main',
          ...text.b,
          endingId: SURVIVED_ENDING_ID,
          mutuallyExclusiveWith: ['route-a'],
        },
      },
    });
    const GERMAN_TEXT = {
      a: {
        description: 'Behalte den Armored case für dich',
        notes: 'Ende der Menschheit – arbeite mit Mr. Kerman zusammen',
      },
      b: {
        description: 'Übergib den Armored case an Prapor',
        notes: 'Ende des Überlebenden – zahle Prapor',
      },
    };
    const ENGLISH_TEXT = {
      a: {
        description: 'Keep the armored case for yourself',
        notes: 'Savior ending - cooperate with Mr. Kerman',
      },
      b: {
        description: 'Hand over the armored case to Prapor',
        notes: 'Survivor ending - pay Prapor',
      },
    };
    const endingsOf = async (chapter: StoryChapter) => {
      const { normalizedChapters } = await loadComposable([chapter]);
      return requireDefined(normalizedChapters.value[0], 'Expected route chapter').endings;
    };
    it('finds the endings when the objective text is German', async () => {
      const endings = await endingsOf(routeChapter(GERMAN_TEXT));
      expect(endings.map((ending) => ending.objectiveId)).toEqual(['route-a', 'route-b']);
      expect(endings.map((ending) => ending.labelKey)).toEqual([
        'page.storyline.ending_names.escaped_for_humanity',
        'page.storyline.ending_names.escaped_and_survived',
      ]);
      expect(endings[0]?.objectiveLabel).toBe('Behalte den Armored case für dich');
    });
    it('detects the same endings whatever language the text is in', async () => {
      const shape = (endings: Awaited<ReturnType<typeof endingsOf>>) =>
        endings.map(({ id, label, labelKey, objectiveId, routeChoiceIndex, routeState }) => ({
          id,
          label,
          labelKey,
          objectiveId,
          routeChoiceIndex,
          routeState,
        }));
      const german = shape(await endingsOf(routeChapter(GERMAN_TEXT)));
      const english = shape(await endingsOf(routeChapter(ENGLISH_TEXT)));
      expect(german).toHaveLength(2);
      expect(german).toEqual(english);
    });
    it('reports one ending when several objectives carry the same ending id', async () => {
      const chapter = routeChapter(GERMAN_TEXT);
      chapter.objectives!['route-c'] = {
        description: 'Übergib den Armored case an Prapor',
        endingId: HUMANITY_ENDING_ID,
        id: 'route-c',
        mutuallyExclusiveWith: ['route-b'],
        order: 3,
        type: 'main',
      };
      const endings = await endingsOf(chapter);
      expect(endings.map((ending) => ending.labelKey)).toEqual([
        'page.storyline.ending_names.escaped_for_humanity',
        'page.storyline.ending_names.escaped_and_survived',
      ]);
    });
    it.each([
      ['an unknown hex id', 'ffffffffffffffffffffffff'],
      ['a prototype key', '__proto__'],
      ['an inherited property name', 'constructor'],
      ['an empty string', ''],
      ['a non-string value', 42],
      ['a wrong-cased known id', HUMANITY_ENDING_ID.toUpperCase()],
    ])('ignores %s as an ending id', async (_label, endingId) => {
      const chapter = routeChapter(GERMAN_TEXT);
      for (const objective of Object.values(chapter.objectives!)) {
        objective.endingId = endingId as unknown as string;
      }
      expect(await endingsOf(chapter)).toEqual([]);
    });
    it('names a declared ending by its id, whatever the systemName says', async () => {
      const chapter = structuredClone(DECLARED_ENDING_CHAPTER);
      chapter.endings = [
        {
          id: FALLEN_ENDING_ID,
          systemName: 'EscapedFromTarkovToFallInTheDarkness',
          gateQuestId: 'quest-fallen',
          objectiveCount: 0,
          resolvedInReference: false,
        },
        {
          id: 'ending-unknown',
          systemName: 'SomethingNew',
          gateQuestId: 'quest-new',
          objectiveCount: 0,
          resolvedInReference: false,
        },
      ];
      const endings = await endingsOf(chapter);
      expect(endings.map((ending) => ending.labelKey)).toEqual([
        'page.storyline.ending_names.escaped_to_fall_in_the_darkness',
        null,
      ]);
      expect(endings.map((ending) => ending.label)).toEqual([
        'Escaped From Tarkov To Fall In The Darkness',
        'Something New',
      ]);
    });
  });
  it('reads endings, quest routes, and coverage from overlay-declared chapter data', async () => {
    objectiveCompletionState.add('the-ticket:obj-gate-1');
    objectiveCompletionState.add('the-ticket:obj-keep');
    const { normalizedChapters } = await loadComposable([DECLARED_ENDING_CHAPTER]);
    const chapter = requireDefined(normalizedChapters.value[0], 'Expected the-ticket chapter');
    expect(chapter.coveragePartial).toBe(true);
    expect(chapter.endings).toEqual([
      {
        evidencePending: false,
        id: 'ending-resolved',
        label: 'Escaped From Tarkov For Humanity',
        labelKey: null,
        objectiveCompleted: 1,
        objectiveId: '',
        objectiveLabel: '',
        objectiveTotal: 2,
        routeBlockingAlternatives: [],
        routeChoiceIndex: null,
        routeState: 'open',
        systemName: 'EscapedFromTarkovForHumanity',
      },
      {
        evidencePending: true,
        id: 'ending-pending',
        label: 'You Didnt Escape From Yourself',
        labelKey: null,
        objectiveCompleted: 0,
        objectiveId: '',
        objectiveLabel: '',
        objectiveTotal: 0,
        routeBlockingAlternatives: [],
        routeChoiceIndex: null,
        routeState: 'open',
        systemName: 'YouDidntEscapeFromYourself',
      },
    ]);
    expect(chapter.questRouteChoices).toEqual([
      {
        branches: [
          {
            completedCount: 0,
            evidencePending: false,
            id: 'quest-hand-over',
            knownStepsComplete: false,
            label: 'Hand the case over',
            totalCount: 1,
          },
          {
            completedCount: 1,
            evidencePending: false,
            id: 'quest-keep',
            knownStepsComplete: true,
            label: 'Keep the case',
            totalCount: 1,
          },
        ],
        // The fixture chapter reports partial coverage, so no route is proven finished.
        chosenBranchId: null,
        conflicting: false,
        coveragePartial: true,
        id: 'the-ticket-quest-route-quest-hand-over-quest-keep',
      },
    ]);
    const handOver = requireDefined(
      chapter.objectives.find((objective) => objective.id === 'obj-hand'),
      'Expected obj-hand objective'
    );
    expect(handOver.routeState).toBe('open');
    expect(chapter.mainRouteChoices).toEqual([]);
  });
  it('keeps a declared route whose objectives the capture does not include', async () => {
    const chapter = structuredClone(DECLARED_ENDING_CHAPTER);
    chapter.mutuallyExclusiveQuestPairs = [['quest-keep', 'quest-missing']];
    const { normalizedChapters } = await loadComposable([chapter]);
    const normalized = requireDefined(normalizedChapters.value[0], 'Expected the-ticket chapter');
    expect(normalized.questRouteChoices).toHaveLength(1);
    expect(normalized.questRouteChoices[0]?.branches.map((branch) => branch.id)).toEqual([
      'quest-keep',
      'quest-missing',
    ]);
    expect(normalized.questRouteChoices[0]?.branches[1]).toMatchObject({
      evidencePending: true,
      knownStepsComplete: false,
      totalCount: 0,
    });
  });
  it('proves a chosen route only when chapter coverage is complete', async () => {
    const chapter = structuredClone(DECLARED_ENDING_CHAPTER);
    chapter.referenceCoverage = {
      referencedSubquests: 4,
      resolvedSubquests: 4,
      partial: false,
    };
    objectiveCompletionState.add('the-ticket:obj-keep');
    const { normalizedChapters } = await loadComposable([chapter]);
    const normalized = requireDefined(normalizedChapters.value[0], 'Expected the-ticket chapter');
    expect(normalized.questRouteChoices[0]).toMatchObject({
      chosenBranchId: 'quest-keep',
      conflicting: false,
      coveragePartial: false,
    });
  });
  it('flags a conflict only when complete coverage proves both routes finished', async () => {
    objectiveCompletionState.add('the-ticket:obj-keep');
    objectiveCompletionState.add('the-ticket:obj-hand');
    const partial = await loadComposable([DECLARED_ENDING_CHAPTER]);
    // Partial coverage cannot prove either route finished, so progress on both is not a conflict.
    expect(
      requireDefined(partial.normalizedChapters.value[0], 'chapter').questRouteChoices[0]
    ).toMatchObject({
      chosenBranchId: null,
      conflicting: false,
    });
    const chapter = structuredClone(DECLARED_ENDING_CHAPTER);
    chapter.referenceCoverage = { referencedSubquests: 4, resolvedSubquests: 4, partial: false };
    const complete = await loadComposable([chapter]);
    expect(
      requireDefined(complete.normalizedChapters.value[0], 'chapter').questRouteChoices[0]
    ).toMatchObject({
      chosenBranchId: null,
      conflicting: true,
    });
  });
  it('never implies exclusivity between quests the overlay did not pair', async () => {
    const chapter = structuredClone(DECLARED_ENDING_CHAPTER);
    chapter.mutuallyExclusiveQuestPairs = [
      ['quest-keep', 'quest-hand-over'],
      ['quest-keep', 'quest-gate'],
    ];
    const { normalizedChapters } = await loadComposable([chapter]);
    const normalized = requireDefined(normalizedChapters.value[0], 'Expected the-ticket chapter');
    expect(
      normalized.questRouteChoices.map((routeChoice) =>
        routeChoice.branches.map((branch) => branch.id)
      )
    ).toEqual([
      ['quest-gate', 'quest-keep'],
      ['quest-hand-over', 'quest-keep'],
    ]);
  });
  it('marks an ending chosen once every objective it declares is complete', async () => {
    objectiveCompletionState.add('the-ticket:obj-gate-1');
    objectiveCompletionState.add('the-ticket:obj-gate-2');
    const { normalizedChapters } = await loadComposable([DECLARED_ENDING_CHAPTER]);
    const chapter = requireDefined(normalizedChapters.value[0], 'Expected the-ticket chapter');
    expect(chapter.endings[0]).toMatchObject({ objectiveCompleted: 2, routeState: 'chosen' });
  });
  it('treats an explicitly empty ending list as authoritative', async () => {
    const chapter = structuredClone(STORY_CHAPTERS[0]!);
    chapter.endings = [];
    const { normalizedChapters } = await loadComposable([chapter]);
    const normalized = requireDefined(normalizedChapters.value[0], 'Expected first chapter');
    expect(normalized.endings).toEqual([]);
  });
  it('keeps an unresolved ending open and drops malformed entries', async () => {
    const chapter = structuredClone(DECLARED_ENDING_CHAPTER);
    const unresolvedEnding = requireDefined(
      chapter.endings?.[1],
      'Expected the unresolved ending fixture'
    );
    chapter.endings = [
      { ...unresolvedEnding, objectiveCount: 1 },
      null as unknown as StoryChapterEnding,
    ];
    chapter.objectives!['obj-pending'] = {
      description: 'Reach the unresolved branch',
      endingId: 'ending-pending',
      id: 'obj-pending',
      order: 5,
      sourceQuestId: 'quest-pending',
      type: 'main',
    };
    objectiveCompletionState.add('the-ticket:obj-pending');
    const { normalizedChapters } = await loadComposable([chapter]);
    const normalized = requireDefined(normalizedChapters.value[0], 'Expected the-ticket chapter');
    expect(normalized.endings).toHaveLength(1);
    expect(normalized.endings[0]).toMatchObject({
      evidencePending: true,
      objectiveCompleted: 1,
      objectiveTotal: 1,
      routeState: 'open',
    });
  });
  it('reports completed objective marks that upstream re-keyed', async () => {
    const { normalizedChapters } = await loadComposable([DECLARED_ENDING_CHAPTER], {
      completedObjectiveIds: () => ['obj-gate-1', 'the-ticket-main-10'],
    });
    const chapter = requireDefined(normalizedChapters.value[0], 'Expected the-ticket chapter');
    expect(chapter.staleObjectiveIds).toEqual(['the-ticket-main-10']);
  });
  it('reports no stale marks without a completed objective source', async () => {
    const { normalizedChapters } = await loadComposable([DECLARED_ENDING_CHAPTER]);
    const chapter = requireDefined(normalizedChapters.value[0], 'Expected the-ticket chapter');
    expect(chapter.staleObjectiveIds).toEqual([]);
  });
});
// The server already serves chapter text in the active language (neutral overlay locale
// patches). These tests drive that localized data through the real view model.
describe('useStorylineChapters localized story text', () => {
  const TRADER_ID = '54cb57776803fa99248b456e';
  const MAP_ID = '59fc81d786f774390775787e';
  const LOCALIZED_CHAPTER: StoryChapter = {
    id: 'falling-skies',
    name: 'Fallender Himmel',
    normalizedName: 'falling-skies',
    wikiLink: 'https://example.com/falling-skies',
    order: 2,
    chapterRequirements: [
      { id: 'tour', name: 'Tour' },
      { id: 'unknown-chapter', name: 'Unknown chapter' },
    ],
    activation: { summary: 'Frage Mechanic im Verlauf von Tour nach dem abgestürzten Flugzeug.' },
    notes: 'Wenn du den Armored case behältst, verlierst du 0,3 Ansehen bei Prapor.',
    rewards: { description: 'Schaltet den Erfolg „Pathfinder“ frei' },
    mapUnlocks: [{ id: MAP_ID, name: 'Factory (night)' }],
    traderUnlocks: [{ id: TRADER_ID, name: 'Therapist' }],
    objectives: {
      'obj-1': {
        id: 'obj-1',
        order: 1,
        type: 'main',
        description: 'Sprich mit Therapist',
        notes: 'Schrittnotiz auf Deutsch',
        unlocks: [
          {
            type: 'map',
            id: MAP_ID,
            name: 'Factory (night)',
            note: 'Wird nach Abschluss des Customs-Abschnitts freigeschaltet.',
          },
          { type: 'trader', id: TRADER_ID, name: 'Therapist' },
          { type: 'trader', id: 'unknown-trader', name: 'Mystery trader' },
          { type: 'achievement', id: 'ach-1', name: 'Pathfinder' },
        ],
      },
    },
  };
  const TOUR: StoryChapter = {
    id: 'tour',
    name: 'Tour',
    normalizedName: 'tour',
    wikiLink: '',
    order: 1,
    objectives: {},
  };
  const METADATA = {
    maps: [{ id: MAP_ID, name: 'Factory bei Nacht' }],
    traders: [{ id: TRADER_ID, name: 'Therapeutin' }],
  };
  const chapterOf = async (metadata: { maps?: unknown; traders?: unknown }) => {
    const { normalizedChapters } = await loadComposable([TOUR, LOCALIZED_CHAPTER], {}, metadata);
    return requireDefined(
      normalizedChapters.value.find((chapter) => chapter.id === 'falling-skies'),
      'Expected falling-skies chapter'
    );
  };
  it('passes the localized notes, activation summary and rewards text through unchanged', async () => {
    const chapter = await chapterOf(METADATA);
    expect(chapter.notes).toBe(
      'Wenn du den Armored case behältst, verlierst du 0,3 Ansehen bei Prapor.'
    );
    expect(chapter.activation?.summary).toBe(
      'Frage Mechanic im Verlauf von Tour nach dem abgestürzten Flugzeug.'
    );
    expect(chapter.rewards?.description).toBe('Schaltet den Erfolg „Pathfinder“ frei');
    expect(chapter.objectives[0]?.notes).toBe('Schrittnotiz auf Deutsch');
    expect(chapter.objectives[0]?.unlocks[0]?.note).toBe(
      'Wird nach Abschluss des Customs-Abschnitts freigeschaltet.'
    );
  });
  it('renders trader and map unlock names from the localized metadata by id', async () => {
    const chapter = await chapterOf(METADATA);
    expect(chapter.objectives[0]?.unlocks.map((unlock) => unlock.label)).toEqual([
      'Factory bei Nacht',
      'Therapeutin',
      'Mystery trader',
      'Pathfinder',
    ]);
  });
  it('localizes the chapter-level unlocks the objectives do not place', async () => {
    const { normalizedChapters } = await loadComposable(
      [{ ...LOCALIZED_CHAPTER, objectives: {} }],
      {},
      METADATA
    );
    expect(normalizedChapters.value[0]?.chapterUnlocks.map((unlock) => unlock.label)).toEqual([
      'Factory bei Nacht',
      'Therapeutin',
      'Schaltet den Erfolg „Pathfinder“ frei',
    ]);
  });
  it('names a required chapter after its localized chapter name, not the overlay name', async () => {
    const localizedTour = { ...TOUR, name: 'Tour (de)' };
    const { normalizedChapters } = await loadComposable([localizedTour, LOCALIZED_CHAPTER]);
    const chapter = requireDefined(normalizedChapters.value[1], 'Expected second chapter');
    expect(chapter.requirements.map((requirement) => requirement.label)).toEqual([
      'Tour (de)',
      'Unknown chapter',
    ]);
  });
  it.each([
    ['no metadata loaded yet', {}],
    ['empty metadata arrays', { maps: [], traders: [] }],
    [
      'a blank localized name',
      { maps: [{ id: MAP_ID, name: '  ' }], traders: [{ id: TRADER_ID }] },
    ],
    [
      'unrelated ids only',
      { maps: [{ id: 'other', name: 'X' }], traders: [{ id: 'other', name: 'Y' }] },
    ],
  ])('falls back to the overlay name with %s', async (_label, metadata) => {
    const chapter = await chapterOf(metadata);
    expect(chapter.objectives[0]?.unlocks.map((unlock) => unlock.label)).toEqual([
      'Factory (night)',
      'Therapist',
      'Mystery trader',
      'Pathfinder',
    ]);
  });
  it('never takes the label of an achievement unlock from a trader or map with the same id', async () => {
    const chapter = await chapterOf({
      maps: [{ id: 'ach-1', name: 'Wrong map' }],
      traders: [{ id: 'ach-1', name: 'Wrong trader' }],
    });
    expect(chapter.objectives[0]?.unlocks[3]?.label).toBe('Pathfinder');
  });
  it('localizes an id-less unlock through the chapter unlock list that names it', async () => {
    const idless: StoryChapter = {
      ...LOCALIZED_CHAPTER,
      objectives: {
        'obj-1': {
          id: 'obj-1',
          order: 1,
          type: 'main',
          description: 'x',
          unlocks: [{ type: 'trader', name: 'Therapist' }],
        },
      },
    };
    const { normalizedChapters } = await loadComposable([idless], {}, METADATA);
    expect(normalizedChapters.value[0]?.objectives[0]?.unlocks[0]).toMatchObject({
      id: TRADER_ID,
      label: 'Therapeutin',
    });
  });
});
