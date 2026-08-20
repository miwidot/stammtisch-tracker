// @vitest-environment happy-dom
import { mockNuxtImport } from '@nuxt/test-utils/runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import requireAuthMiddleware from '@/middleware/require-auth.global';
const { loggerMock, navigateToMock, readyMock, state } = vi.hoisted(() => ({
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
});
