import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureSupabaseReadyForRoute } from '@/utils/supabaseGuard';
import { SupabaseCallbackPendingError } from '@/utils/supabaseReadiness';
const { loggerMock } = vi.hoisted(() => ({ loggerMock: { error: vi.fn() } }));
vi.mock('@/utils/logger', () => ({ logger: loggerMock }));
describe('ensureSupabaseReadyForRoute', () => {
  beforeEach(() => loggerMock.error.mockClear());
  it("returns 'ready' once the Supabase client reports ready", async () => {
    const supabase = { ready: vi.fn().mockResolvedValue(undefined), user: { loggedIn: false } };
    await expect(ensureSupabaseReadyForRoute(supabase, 'Test middleware')).resolves.toBe('ready');
    expect(loggerMock.error).not.toHaveBeenCalled();
  });
  it("returns 'callback_pending' without logging while an OAuth callback is in flight", async () => {
    const user = { loggedIn: true };
    const supabase = {
      ready: vi.fn().mockRejectedValue(new SupabaseCallbackPendingError()),
      user,
    };
    await expect(ensureSupabaseReadyForRoute(supabase, 'Test middleware')).resolves.toBe(
      'callback_pending'
    );
    expect(user.loggedIn).toBe(true);
    expect(loggerMock.error).not.toHaveBeenCalled();
  });
  it("returns 'failed', resets the user and logs when Supabase bootstrap fails", async () => {
    const bootstrapError = new Error('bootstrap failed');
    const user = { loggedIn: true };
    const supabase = { ready: vi.fn().mockRejectedValue(bootstrapError), user };
    await expect(ensureSupabaseReadyForRoute(supabase, 'Test middleware')).resolves.toBe('failed');
    expect(user.loggedIn).toBe(false);
    expect(loggerMock.error).toHaveBeenCalledWith(
      'Test middleware: Supabase bootstrap failed',
      bootstrapError
    );
  });
  // Regression from the 1.85.0 sync: during server rendering the browser-only plugin does not
  // exist, so the guard received undefined and its own catch block threw "reading 'user'".
  it.each([undefined, null])(
    "returns 'failed' without throwing when supabase is %s",
    async (supabase) => {
      await expect(ensureSupabaseReadyForRoute(supabase, 'Test middleware')).resolves.toBe(
        'failed'
      );
      expect(loggerMock.error).toHaveBeenCalledWith('Test middleware: Supabase client unavailable');
    }
  );
});
