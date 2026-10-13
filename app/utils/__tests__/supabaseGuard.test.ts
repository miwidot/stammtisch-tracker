import { describe, expect, it, vi } from 'vitest';
import { ensureSupabaseReadyForRoute } from '@/utils/supabaseGuard';
const { loggerMock } = vi.hoisted(() => ({
  loggerMock: {
    error: vi.fn(),
  },
}));
vi.mock('@/utils/logger', () => ({
  logger: loggerMock,
}));
describe('ensureSupabaseReadyForRoute', () => {
  it('returns true once the Supabase client reports ready', async () => {
    const supabase = { ready: vi.fn().mockResolvedValue(undefined), user: { loggedIn: false } };
    await expect(ensureSupabaseReadyForRoute(supabase, 'Test middleware')).resolves.toBe(true);
    expect(loggerMock.error).not.toHaveBeenCalled();
  });
  it('resets the user and logs when Supabase bootstrap fails', async () => {
    const bootstrapError = new Error('bootstrap failed');
    const user = { loggedIn: true };
    const supabase = { ready: vi.fn().mockRejectedValue(bootstrapError), user };
    await expect(ensureSupabaseReadyForRoute(supabase, 'Test middleware')).resolves.toBe(false);
    expect(user.loggedIn).toBe(false);
    expect(loggerMock.error).toHaveBeenCalledWith(
      'Test middleware: Supabase bootstrap failed',
      bootstrapError
    );
  });
  // Regression (1.85.0 merge): server-rendered requests to the now-SSR'd PUBLIC_SEO_ROUTES
  // never have the Supabase client plugin (app/plugins/supabase.client.ts is browser-only),
  // so callers that forget a server guard pass `undefined`/`null` here. Before this fix, the
  // catch block itself threw on `supabase.user` for an undefined `supabase`, masking the real
  // "client unavailable" condition behind "Cannot read properties of undefined (reading
  // 'user')" - this is the exact TypeError that crashed the `pnpm build` prerender.
  it.each([undefined, null])(
    'returns false without throwing when supabase is %s',
    async (supabase) => {
      await expect(ensureSupabaseReadyForRoute(supabase, 'Test middleware')).resolves.toBe(false);
      expect(loggerMock.error).toHaveBeenCalledWith('Test middleware: Supabase client unavailable');
    }
  );
});
