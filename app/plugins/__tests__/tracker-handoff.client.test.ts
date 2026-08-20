// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const { loggerMock } = vi.hoisted(() => ({
  loggerMock: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));
vi.mock('@/utils/logger', () => ({
  logger: loggerMock,
}));
const OFFLINE_STUB_MARKER = 'offline-stub';
const setHash = (hash: string) => {
  window.history.replaceState(null, '', `/dashboard${hash}`);
};
describe('tracker-handoff plugin', () => {
  beforeEach(() => {
    vi.resetModules();
    Object.values(loggerMock).forEach((fn) => fn.mockClear());
    setHash('');
  });
  afterEach(() => {
    setHash('');
  });
  it('redeems a valid handoff token and removes it from the URL', async () => {
    setHash('#tracker_token=abc123');
    const verifyOtp = vi.fn().mockResolvedValue({ data: {}, error: null });
    const ready = vi.fn().mockResolvedValue(undefined);
    const nuxtApp = {
      $supabase: {
        client: { auth: { verifyOtp } },
        ready,
      },
    };
    const plugin = (await import('@/plugins/tracker-handoff.client')).default;
    await plugin.setup?.(nuxtApp as unknown as Parameters<NonNullable<typeof plugin.setup>>[0]);
    expect(ready).toHaveBeenCalledTimes(1);
    expect(verifyOtp).toHaveBeenCalledExactlyOnceWith({
      token_hash: 'abc123',
      type: 'email',
    });
    expect(window.location.hash).toBe('');
    expect(window.location.pathname).toBe('/dashboard');
  });
  it('does nothing when the URL has no handoff fragment', async () => {
    setHash('');
    const verifyOtp = vi.fn();
    const ready = vi.fn();
    const nuxtApp = {
      $supabase: {
        client: { auth: { verifyOtp } },
        ready,
      },
    };
    const plugin = (await import('@/plugins/tracker-handoff.client')).default;
    await expect(
      plugin.setup?.(nuxtApp as unknown as Parameters<NonNullable<typeof plugin.setup>>[0])
    ).resolves.not.toThrow();
    expect(ready).not.toHaveBeenCalled();
    expect(verifyOtp).not.toHaveBeenCalled();
  });
  it('handles a verifyOtp failure without throwing, removes the token, and never logs it', async () => {
    setHash('#tracker_token=super-secret-token');
    const verifyOtp = vi.fn().mockResolvedValue({
      data: {},
      error: { message: 'Token has expired or is invalid' },
    });
    const ready = vi.fn().mockResolvedValue(undefined);
    const nuxtApp = {
      $supabase: {
        client: { auth: { verifyOtp } },
        ready,
      },
    };
    const plugin = (await import('@/plugins/tracker-handoff.client')).default;
    await expect(
      plugin.setup?.(nuxtApp as unknown as Parameters<NonNullable<typeof plugin.setup>>[0])
    ).resolves.not.toThrow();
    expect(window.location.hash).toBe('');
    expect(loggerMock.warn).toHaveBeenCalled();
    const allLoggedArgs = JSON.stringify([
      ...loggerMock.warn.mock.calls,
      ...loggerMock.error.mock.calls,
    ]);
    expect(allLoggedArgs).not.toContain('super-secret-token');
  });
  it('waits for supabase.ready() before touching the client, never calling the offline stub', async () => {
    setHash('#tracker_token=needs-ready');
    const stubVerifyOtp = vi.fn().mockRejectedValue(new Error(OFFLINE_STUB_MARKER));
    const realVerifyOtp = vi.fn().mockResolvedValue({ data: {}, error: null });
    const supabaseState: {
      client: { auth: { verifyOtp: typeof stubVerifyOtp } };
      ready: () => Promise<void>;
    } = {
      client: { auth: { verifyOtp: stubVerifyOtp } },
      ready: vi.fn().mockImplementation(async () => {
        supabaseState.client = { auth: { verifyOtp: realVerifyOtp } };
      }),
    };
    const nuxtApp = { $supabase: supabaseState };
    const plugin = (await import('@/plugins/tracker-handoff.client')).default;
    await plugin.setup?.(nuxtApp as unknown as Parameters<NonNullable<typeof plugin.setup>>[0]);
    expect(stubVerifyOtp).not.toHaveBeenCalled();
    expect(realVerifyOtp).toHaveBeenCalledExactlyOnceWith({
      token_hash: 'needs-ready',
      type: 'email',
    });
  });
  it.each([
    ['empty token value', '#tracker_token='],
    ['whitespace-only token value', '#tracker_token=%20%20'],
    ['malformed percent-encoding', '#tracker_token=abc%25XYZ'],
  ])('cleanly ignores a broken fragment token (%s)', async (_label, hash) => {
    setHash(hash);
    const verifyOtp = vi.fn();
    const ready = vi.fn();
    const nuxtApp = {
      $supabase: {
        client: { auth: { verifyOtp } },
        ready,
      },
    };
    const plugin = (await import('@/plugins/tracker-handoff.client')).default;
    await expect(
      plugin.setup?.(nuxtApp as unknown as Parameters<NonNullable<typeof plugin.setup>>[0])
    ).resolves.not.toThrow();
    expect(ready).not.toHaveBeenCalled();
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('');
  });
  // Reproduces the real-browser defect: Nuxt's own router plugin registers an `app:created`
  // hook (during router plugin setup, which always resolves before this post-enforce plugin
  // runs) that re-applies the ORIGINAL initial route -- fragment included -- via router.replace()
  // whenever nothing has updated `router.currentRoute.value` since. The old test only asserted
  // that `history.replaceState` was called during `setup()`, which stayed green even though a
  // plain history edit never touches router state and gets stomped by that later replay. These
  // tests assert the real end state -- window.location.hash and router.currentRoute.value.hash --
  // AFTER the full `app:created` hook cycle runs, in both registration order (matching production)
  // and simulating Nuxt's hook running first.
  describe('surviving Nuxt router’s app:created replay', () => {
    const buildFakeRouter = (initialHash: string) => {
      const router = {
        currentRoute: {
          value: { hash: initialHash, path: '/dashboard', query: {} as Record<string, string> },
        },
        replace: vi.fn(
          async (to: { hash: string; path: string; query: Record<string, string> }) => {
            router.currentRoute.value = { hash: to.hash, path: to.path, query: to.query };
            window.history.replaceState(null, '', `${to.path}${to.hash}`);
          }
        ),
      };
      return router;
    };
    const buildHookRegistry = () => {
      const listeners: Array<() => void | Promise<void>> = [];
      return {
        fire: async () => {
          for (const listener of listeners) await listener();
        },
        hook: vi.fn((_event: string, fn: () => void | Promise<void>) => {
          listeners.push(fn);
        }),
      };
    };
    it('wins the race against a successful-redemption replay', async () => {
      const initialHash = '#tracker_token=abc123';
      setHash(initialHash);
      const router = buildFakeRouter(initialHash);
      const registry = buildHookRegistry();
      // Simulates Nuxt's router plugin registering its own app:created hookOnce before our
      // post-enforce plugin runs -- it unconditionally replays the original, fragment-bearing route.
      registry.hook('app:created', () => {
        void router.replace({ hash: initialHash, path: '/dashboard', query: {} });
      });
      const verifyOtp = vi.fn().mockResolvedValue({ data: {}, error: null });
      const ready = vi.fn().mockResolvedValue(undefined);
      const nuxtApp = {
        $router: router,
        $supabase: { client: { auth: { verifyOtp } }, ready },
        hook: registry.hook,
      };
      const plugin = (await import('@/plugins/tracker-handoff.client')).default;
      await plugin.setup?.(nuxtApp as unknown as Parameters<NonNullable<typeof plugin.setup>>[0]);
      await registry.fire();
      expect(window.location.hash).toBe('');
      expect(router.currentRoute.value.hash).toBe('');
    });
    it('wins the race against a failed-redemption replay and never logs the token', async () => {
      const initialHash = '#tracker_token=super-secret-token';
      setHash(initialHash);
      const router = buildFakeRouter(initialHash);
      const registry = buildHookRegistry();
      registry.hook('app:created', () => {
        void router.replace({ hash: initialHash, path: '/dashboard', query: {} });
      });
      const verifyOtp = vi.fn().mockResolvedValue({
        data: {},
        error: { message: 'Token has expired or is invalid' },
      });
      const ready = vi.fn().mockResolvedValue(undefined);
      const nuxtApp = {
        $router: router,
        $supabase: { client: { auth: { verifyOtp } }, ready },
        hook: registry.hook,
      };
      const plugin = (await import('@/plugins/tracker-handoff.client')).default;
      await plugin.setup?.(nuxtApp as unknown as Parameters<NonNullable<typeof plugin.setup>>[0]);
      await registry.fire();
      expect(window.location.hash).toBe('');
      expect(router.currentRoute.value.hash).toBe('');
      const allLoggedArgs = JSON.stringify([
        ...loggerMock.warn.mock.calls,
        ...loggerMock.error.mock.calls,
      ]);
      expect(allLoggedArgs).not.toContain('super-secret-token');
    });
  });
});
