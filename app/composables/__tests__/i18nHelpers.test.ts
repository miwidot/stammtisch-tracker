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
    const { resetI18nReady, useSafeLocale } = await import('@/composables/i18nHelpers');
    resetI18nReady();
    expect(useSafeLocale().value).toBe('de');
  });
  it('falls back to browser locale when a stored override is no longer supported', async () => {
    localStorage.setItem(
      STORAGE_KEYS.preferences,
      serializeUserScopedStorage({ localeOverride: 'fr' }, null)
    );
    localStorage.setItem('sb-test-auth-token', 'token');
    const { resetI18nReady, useSafeLocale } = await import('@/composables/i18nHelpers');
    resetI18nReady();
    expect(useSafeLocale().value).toBe('en');
  });
  it('falls back to the app default when browser locale is not supported by the UI', async () => {
    vi.stubGlobal('navigator', { ...window.navigator, language: 'ja-JP' });
    const { resetI18nReady, useSafeLocale } = await import('@/composables/i18nHelpers');
    resetI18nReady();
    expect(useSafeLocale().value).toBe('de');
  });
});
