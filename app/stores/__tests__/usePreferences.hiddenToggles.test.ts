// Fork decision (STREAMER_MODE_PREFERENCE_ENABLED / ANTIFANDOM_PREFERENCE_ENABLED = false in
// app/utils/forkConfig.ts): both preference rows are hidden, so a value stored earlier must
// resolve to the default instead of acting invisibly.
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePreferencesStore } from '@/stores/usePreferences';
import { clearHiddenStreamerMode } from '@/utils/hiddenPreferences';
import { rewriteWikiUrl } from '@/utils/wikiLink';
vi.mock('@/utils/forkConfig', () => ({
  LIGHT_THEME_ENABLED: false,
  OVERFLOW_MENU_ENABLED: false,
  STREAMER_MODE_PREFERENCE_ENABLED: false,
  ANTIFANDOM_PREFERENCE_ENABLED: false,
}));
describe('hidden preferences resolve to upstream defaults', () => {
  beforeEach(() => setActivePinia(createPinia()));
  it('getStreamerMode is false even when streamerMode=true was stored earlier', () => {
    const store = usePreferencesStore();
    store.streamerMode = true;
    expect(store.getStreamerMode).toBe(false);
  });
  it('getWikiUseAntifandom is false even when it was enabled earlier, so wiki links keep fandom.com', () => {
    const store = usePreferencesStore();
    store.wikiUseAntifandom = true;
    expect(store.getWikiUseAntifandom).toBe(false);
    const url = 'https://escapefromtarkov.fandom.com/wiki/Prapor';
    expect(rewriteWikiUrl(url, store.getWikiUseAntifandom)).toBe(url);
  });
  it('clearHiddenStreamerMode clears a stored true and reports it so the caller pushes it', () => {
    const store = usePreferencesStore();
    store.streamerMode = true;
    expect(clearHiddenStreamerMode(store)).toBe(true);
    expect(store.streamerMode).toBe(false);
  });
  it.each([false, undefined])('clearHiddenStreamerMode is a no-op for %s', (value) => {
    const setStreamerMode = vi.fn();
    expect(
      clearHiddenStreamerMode({ streamerMode: value as boolean | undefined, setStreamerMode })
    ).toBe(false);
    expect(setStreamerMode).not.toHaveBeenCalled();
  });
});
