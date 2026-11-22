/**
 * The storyline's endings as the client serves them from `client/ending_list`. The overlay keeps
 * this set closed (its schema enum), so these ids are the only ones a chapter can declare or tag.
 * An ending is recognised and named by its id, which is the same in every language; the objective
 * text that describes an ending is translated and must never be used to recognise one.
 *
 * i18n keys are snake_case words rather than the raw ids because the locale lint requires it.
 */
interface StoryEnding {
  /** The client's own name, used to build an English fallback label. */
  systemName: string;
  /** Message holding the ending's display name. */
  labelKey: string;
}
const STORY_ENDINGS: Readonly<Record<string, StoryEnding>> = {
  '68a6e8f1a7455e5e23099ad8': {
    systemName: 'EscapedFromTarkovForHumanity',
    labelKey: 'page.storyline.ending_names.escaped_for_humanity',
  },
  '68a6e8c834a37e244710d516': {
    systemName: 'EscapedFromTarkovAndSurvived',
    labelKey: 'page.storyline.ending_names.escaped_and_survived',
  },
  '68a6e8e4a8d0bee0b5324d96': {
    systemName: 'EscapedFromTarkovToFallInTheDarkness',
    labelKey: 'page.storyline.ending_names.escaped_to_fall_in_the_darkness',
  },
  '68a6028ef4c23ebbbc49da4b': {
    systemName: 'YouDidntEscapeFromYourself',
    labelKey: 'page.storyline.ending_names.not_escaped_from_yourself',
  },
};
export const STORY_ENDING_IDS: readonly string[] = Object.keys(STORY_ENDINGS);
export const isStoryEndingId = (value: unknown): value is string =>
  typeof value === 'string' && Object.hasOwn(STORY_ENDINGS, value);
/** i18n key holding the ending's display name, or null for an id the client does not ship. */
export const storyEndingLabelKey = (id: unknown): string | null =>
  isStoryEndingId(id) ? STORY_ENDINGS[id]!.labelKey : null;
const humanizeSystemName = (systemName: string): string =>
  systemName.replace(/([a-z\d])([A-Z])/g, '$1 $2').trim() || systemName;
/** Untranslated English name, used when no locale string is available. */
export const storyEndingFallbackLabel = (id: string, systemName?: string): string => {
  const name = systemName ?? (isStoryEndingId(id) ? STORY_ENDINGS[id]!.systemName : undefined);
  return name ? humanizeSystemName(name) : 'Ending';
};
