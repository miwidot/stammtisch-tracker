// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '@/utils/storageKeys';
import { serializeUserScopedStorage } from '@/utils/userScopedStorage';
describe('useSafeLocale', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    vi.stubGlobal('navigator', { ...window.navigator, language: 'en-US' });
  });
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });
  it('ignores prior user-scoped locale while auth ownership is unresolved', async () => {
    localStorage.setItem(
      STORAGE_KEYS.preferences,
      serializeUserScopedStorage({ localeOverride: 'de' }, 'user-1')
    );
    localStorage.setItem('sb-test-auth-token', 'token');
    const { resetI18nReady, useSafeLocale } = await import('@/composables/i18nHelpers');
    resetI18nReady();
    expect(useSafeLocale().value).toBe('en');
  });
  it('keeps anonymous scoped locale during bootstrap', async () => {
    localStorage.setItem(
      STORAGE_KEYS.preferences,
      serializeUserScopedStorage({ localeOverride: 'de' }, null)
    );
    localStorage.setItem('sb-test-auth-token', 'token');
    vi.stubGlobal('navigator', { ...window.navigator, language: 'en-US' });
    const { resetI18nReady, useSafeLocale } = await import('@/composables/i18nHelpers');
    resetI18nReady();
    expect(useSafeLocale().value).toBe('de');
  });
  it('resolves a Japanese browser locale to German because only de/en are offered', async () => {
    vi.stubGlobal('navigator', { ...window.navigator, language: 'ja-JP' });
    const { resetI18nReady, useSafeLocale } = await import('@/composables/i18nHelpers');
    resetI18nReady();
    expect(useSafeLocale().value).toBe('de');
  });
  it('selects English for an English browser locale', async () => {
    vi.stubGlobal('navigator', { ...window.navigator, language: 'en-GB' });
    const { resetI18nReady, useSafeLocale } = await import('@/composables/i18nHelpers');
    resetI18nReady();
    expect(useSafeLocale().value).toBe('en');
  });
  it('restores a saved English locale over a German browser during anonymous bootstrap', async () => {
    localStorage.setItem(
      STORAGE_KEYS.preferences,
      serializeUserScopedStorage({ localeOverride: 'en' }, null)
    );
    vi.stubGlobal('navigator', { ...window.navigator, language: 'de-DE' });
    const { resetI18nReady, useSafeLocale } = await import('@/composables/i18nHelpers');
    resetI18nReady();
    expect(useSafeLocale().value).toBe('en');
  });
  it.each([
    ['fr', 'en-US', 'en'],
    ['fr', 'fr-FR', 'de'],
    ['tr', 'de-DE', 'de'],
  ])(
    'ignores a saved %s override that is no longer offered (browser %s -> %s)',
    async (saved, browser, expected) => {
      localStorage.setItem(
        STORAGE_KEYS.preferences,
        serializeUserScopedStorage({ localeOverride: saved }, null)
      );
      vi.stubGlobal('navigator', { ...window.navigator, language: browser });
      const { resetI18nReady, useSafeLocale } = await import('@/composables/i18nHelpers');
      resetI18nReady();
      expect(useSafeLocale().value).toBe(expected);
    }
  );
  it('falls back to the fork default German when browser locale is not supported by the UI', async () => {
    vi.stubGlobal('navigator', { ...window.navigator, language: 'ar-SA' });
    const { resetI18nReady, useSafeLocale } = await import('@/composables/i18nHelpers');
    resetI18nReady();
    expect(useSafeLocale().value).toBe('de');
  });
});
