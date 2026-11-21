// @vitest-environment happy-dom
import { mockNuxtImport } from '@nuxt/test-utils/runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import requireAuthMiddleware from '@/middleware/require-auth.global';
import { SupabaseCallbackPendingError } from '@/utils/supabaseReadiness';
const { abortNavigationMock, loggerMock, navigateToMock, readyMock, state } = vi.hoisted(() => ({
  abortNavigationMock: vi.fn(() => 'aborted'),
  loggerMock: {
    error: vi.fn(),
  },
  navigateToMock: vi.fn((path: string) => path),
  readyMock: vi.fn().mockResolvedValue(undefined),
  state: {
    user: {
      email: null as string | null,
      id: null as string | null,
      loggedIn: false,
    },
  },
}));
mockNuxtImport('useNuxtApp', () => () => ({
  $supabase: {
    ready: readyMock,
    user: state.user,
  },
}));
mockNuxtImport('navigateTo', () => navigateToMock);
mockNuxtImport('abortNavigation', () => abortNavigationMock);
mockNuxtImport(
  'defineNuxtRouteMiddleware',
  () => (handler: (...args: unknown[]) => unknown) => handler
);
vi.mock('@/utils/logger', () => ({
  logger: loggerMock,
}));
describe('require-auth global middleware', () => {
  const runMiddleware = (path: string) =>
    Promise.resolve(
      requireAuthMiddleware(
        { path } as Parameters<typeof requireAuthMiddleware>[0],
        {} as Parameters<typeof requireAuthMiddleware>[1]
      )
    );
  beforeEach(() => {
    vi.clearAllMocks();
    readyMock.mockReset();
    readyMock.mockResolvedValue(undefined);
    state.user.loggedIn = false;
    state.user.id = null;
    state.user.email = null;
  });
  it('redirects unauthenticated users hitting the root route to /login', async () => {
    const result = await runMiddleware('/');
    expect(navigateToMock).toHaveBeenCalledWith('/login');
    expect(result).toBe('/login');
  });
  it('does not redirect unauthenticated users already on /login', async () => {
    const result = await runMiddleware('/login');
    expect(navigateToMock).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
    expect(readyMock).not.toHaveBeenCalled();
  });
  it('does not redirect unauthenticated users on /auth/callback', async () => {
    const result = await runMiddleware('/auth/callback');
    expect(navigateToMock).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
    expect(readyMock).not.toHaveBeenCalled();
  });
  it.each(['/herkunft', '/credits', '/about'])(
    'does not redirect unauthenticated users on the public attribution page %s',
    async (path) => {
      const result = await runMiddleware(path);
      expect(navigateToMock).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
      expect(readyMock).not.toHaveBeenCalled();
    }
  );
  it('redirects unauthenticated users away from public profile pages', async () => {
    const result = await runMiddleware('/profile/abc/pvp');
    expect(navigateToMock).toHaveBeenCalledWith('/login');
    expect(result).toBe('/login');
  });
  it('allows authenticated users on any protected route', async () => {
    state.user.loggedIn = true;
    const result = await runMiddleware('/profile/abc/pvp');
    expect(navigateToMock).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });
  it('allows authenticated users on the root route', async () => {
    state.user.loggedIn = true;
    const result = await runMiddleware('/');
    expect(navigateToMock).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });
  it('does not redirect prematurely while Supabase session hydration is still pending', async () => {
    let resolveReady: () => void = () => {};
    readyMock.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveReady = resolve;
        })
    );
    const runPromise = runMiddleware('/');
    await Promise.resolve();
    await Promise.resolve();
    expect(navigateToMock).not.toHaveBeenCalled();
    state.user.loggedIn = true;
    resolveReady();
    const result = await runPromise;
    expect(navigateToMock).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });
  it('redirects to /login when Supabase bootstrap fails', async () => {
    const bootstrapError = new Error('bootstrap failed');
    state.user.loggedIn = true;
    state.user.id = 'user-1';
    state.user.email = 'user@example.com';
    readyMock.mockRejectedValueOnce(bootstrapError);
    const result = await runMiddleware('/');
    expect(navigateToMock).toHaveBeenCalledWith('/login');
    expect(result).toBe('/login');
    expect(state.user.loggedIn).toBe(false);
  });
  describe('readiness outcomes (ensureSupabaseReadyForRoute returns a string, not a boolean)', () => {
    it('aborts navigation instead of redirecting while an OAuth callback is still pending', async () => {
      state.user.loggedIn = false;
      readyMock.mockRejectedValueOnce(new SupabaseCallbackPendingError());
      const result = await runMiddleware('/');
      expect(abortNavigationMock).toHaveBeenCalledOnce();
      expect(navigateToMock).not.toHaveBeenCalled();
      expect(result).toBe('aborted');
    });
    it('does not let a logged-in-looking user through while the callback is pending', async () => {
      state.user.loggedIn = true;
      readyMock.mockRejectedValueOnce(new SupabaseCallbackPendingError());
      const result = await runMiddleware('/tasks');
      expect(result).toBe('aborted');
      expect(state.user.loggedIn).toBe(true);
    });
    it('sends a failed bootstrap to /login and logs it, never falling through to the logged-in check', async () => {
      state.user.loggedIn = true;
      state.user.id = 'user-1';
      readyMock.mockRejectedValueOnce(new Error('network down'));
      const result = await runMiddleware('/tasks');
      expect(result).toBe('/login');
      expect(abortNavigationMock).not.toHaveBeenCalled();
      expect(loggerMock.error).toHaveBeenCalledOnce();
      expect(state.user.loggedIn).toBe(false);
      expect(state.user.id).toBeNull();
    });
    it.each(['/login', '/auth/callback', '/herkunft'])(
      'never consults readiness on the public route %s even if bootstrap would fail',
      async (path) => {
        readyMock.mockRejectedValue(new SupabaseCallbackPendingError());
        const result = await runMiddleware(path);
        expect(result).toBeUndefined();
        expect(readyMock).not.toHaveBeenCalled();
        expect(abortNavigationMock).not.toHaveBeenCalled();
      }
    );
    it('lets a user redeemed through the handoff in while the session is ready', async () => {
      readyMock.mockImplementationOnce(async () => {
        state.user.loggedIn = true;
        state.user.id = 'handoff-user';
      });
      const result = await runMiddleware('/tasks');
      expect(result).toBeUndefined();
      expect(navigateToMock).not.toHaveBeenCalled();
    });
  });
});
