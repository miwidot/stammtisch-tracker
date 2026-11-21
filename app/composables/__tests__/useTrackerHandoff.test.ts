// @vitest-environment happy-dom
import { mockNuxtImport } from '@nuxt/test-utils/runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTrackerHandoff } from '@/composables/useTrackerHandoff';
import { HANDOFF_STATE_STORAGE_KEY } from '@/utils/trackerHandoffState';
const toastAdd = vi.hoisted(() => vi.fn());
mockNuxtImport('useToast', () => () => ({ add: toastAdd }));
mockNuxtImport('useRuntimeConfig', () => () => ({
  public: { trackerHandoffUrl: 'https://dev.tarkov-stammtisch.de/api/tracker/handoff' },
}));
vi.mock('vue-i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}));
vi.mock('@/utils/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));
describe('useTrackerHandoff', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    toastAdd.mockClear();
  });
  it('exposes the plain handoff URL for the link fallback', () => {
    expect(useTrackerHandoff().trackerHandoffUrl).toBe(
      'https://dev.tarkov-stammtisch.de/api/tracker/handoff'
    );
  });
  it('navigates to the handoff URL with the nonce it stored for this tab', () => {
    const location = { href: '', origin: 'https://trackerdev.tarkov-stammtisch.de' };
    vi.stubGlobal('location', location);
    try {
      useTrackerHandoff().startHandoff();
      const target = new URL(location.href);
      expect(target.origin + target.pathname).toBe(
        'https://dev.tarkov-stammtisch.de/api/tracker/handoff'
      );
      const nonce = window.sessionStorage.getItem(HANDOFF_STATE_STORAGE_KEY);
      expect(nonce).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(target.searchParams.get('state')).toBe(nonce);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('uses a fresh nonce on every start', () => {
    const location = { href: '', origin: 'https://t.test' };
    vi.stubGlobal('location', location);
    try {
      const { startHandoff } = useTrackerHandoff();
      startHandoff();
      const first = new URL(location.href).searchParams.get('state');
      startHandoff();
      expect(new URL(location.href).searchParams.get('state')).not.toBe(first);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('shows an error and does not navigate when no nonce can be stored', () => {
    const location = { href: 'https://t.test/login', origin: 'https://t.test' };
    vi.stubGlobal('location', location);
    vi.stubGlobal('sessionStorage', {
      setItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
      getItem: () => null,
      removeItem: () => {},
    });
    try {
      useTrackerHandoff().startHandoff();
      expect(location.href).toBe('https://t.test/login');
      expect(toastAdd).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
