// @vitest-environment happy-dom
/**
 * The handoff plugin is exercised here against the REAL supabase-js client and the REAL
 * owner-fenced auth storage from supabase.client.ts (only the network is faked). The mocked
 * plugin tests cannot see storage-key or owner-fence regressions, which upstream changed
 * after the handoff was written.
 */
import { createClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createOwnerFencedAuthStorage, supabaseAuthStorageKey } from '@/utils/supabaseAuthFence';
vi.mock('@/utils/logger', () => ({
  logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));
const SUPABASE_URL = 'https://tracker.example.test';
const STORAGE_KEY = 'sb-tracker-auth-token';
const OLD_USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const NEW_USER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const sessionFor = (userId: string) => {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return {
    access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: userId, exp, role: 'authenticated' })}.sig`,
    refresh_token: `refresh-${userId}`,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: exp,
    user: {
      id: userId,
      aud: 'authenticated',
      role: 'authenticated',
      app_metadata: {},
      user_metadata: {},
      created_at: '2026-01-01T00:00:00Z',
    },
  };
};
const fetchMock = vi.fn();
const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const memoryBase = (seed?: Record<string, string>) => {
  const values = new Map<string, string>(Object.entries(seed ?? {}));
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
};
const setup = (seed?: Record<string, string>) => {
  const base = memoryBase(seed);
  const fenced = createOwnerFencedAuthStorage(supabaseAuthStorageKey(SUPABASE_URL), base);
  const client = createClient(SUPABASE_URL, 'anon-key', {
    auth: {
      autoRefreshToken: false,
      flowType: 'pkce',
      storage: fenced.storage,
      storageKey: supabaseAuthStorageKey(SUPABASE_URL),
    },
    global: { fetch: fetchMock },
  });
  const ready = vi.fn().mockResolvedValue(null);
  return { base, fenced, client, nuxtApp: { $supabase: { client, ready } } };
};
const runHandoff = async (nuxtApp: unknown, hash: string) => {
  window.history.replaceState(null, '', `/tasks${hash}`);
  const plugin = (await import('@/plugins/tracker-handoff.client')).default;
  await plugin.setup?.(nuxtApp as Parameters<NonNullable<typeof plugin.setup>>[0]);
};
describe('tracker handoff against the real supabase client and owner-fenced storage', () => {
  beforeEach(() => {
    vi.resetModules();
    // A pending login in this tab, as the login page leaves it (see trackerHandoffState.ts).
    window.sessionStorage.setItem('tt_tracker_handoff_state', 'nonce-1');
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes('/auth/v1/verify')) return jsonResponse(200, sessionFor(NEW_USER));
      return jsonResponse(404, {});
    });
  });
  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });
  it('keeps the SDK-default storage key so the handoff session is found by the app', () => {
    expect(supabaseAuthStorageKey(SUPABASE_URL)).toBe(STORAGE_KEY);
  });
  it('redeems the token against /auth/v1/verify and persists the session under that key', async () => {
    const { base, nuxtApp, client } = setup();
    await runHandoff(nuxtApp, '#tracker_token=otp-hash-123&tracker_state=nonce-1');
    const verifyCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes('/auth/v1/verify')
    );
    expect(verifyCall).toBeDefined();
    expect(JSON.parse(String((verifyCall![1] as RequestInit).body))).toMatchObject({
      token_hash: 'otp-hash-123',
      type: 'email',
    });
    const stored = JSON.parse(base.values.get(STORAGE_KEY) ?? 'null');
    expect(stored.user.id).toBe(NEW_USER);
    expect((await client.auth.getSession()).data.session?.user.id).toBe(NEW_USER);
    expect(window.location.hash).toBe('');
  });
  it('never writes the one-time token into auth storage', async () => {
    const { base, nuxtApp } = setup();
    await runHandoff(nuxtApp, '#tracker_token=otp-hash-secret&tracker_state=nonce-1');
    expect([...base.values.values()].join('')).not.toContain('otp-hash-secret');
  });
  it('refuses to replace the session of another account and keeps it intact', async () => {
    const { base, nuxtApp } = setup({ [STORAGE_KEY]: JSON.stringify(sessionFor(OLD_USER)) });
    await runHandoff(nuxtApp, '#tracker_token=otp-hash-swap&tracker_state=nonce-1');
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/auth/v1/verify'))).toBe(
      false
    );
    expect(JSON.parse(base.values.get(STORAGE_KEY)!).user.id).toBe(OLD_USER);
    expect(window.location.hash).toBe('');
  });
  it('redeems after the previous user signed out under the owner fence', async () => {
    const { base, nuxtApp, client, fenced } = setup({
      [STORAGE_KEY]: JSON.stringify(sessionFor(OLD_USER)),
    });
    fetchMock.mockImplementation(async (url: string) =>
      String(url).includes('/auth/v1/verify')
        ? jsonResponse(200, sessionFor(NEW_USER))
        : new Response(null, { status: 204 })
    );
    await fenced.withOwnerFence(OLD_USER, () => client.auth.signOut({ scope: 'global' }));
    expect(base.values.has(STORAGE_KEY)).toBe(false);
    await runHandoff(nuxtApp, '#tracker_token=otp-hash-after&tracker_state=nonce-1');
    expect(JSON.parse(base.values.get(STORAGE_KEY)!).user.id).toBe(NEW_USER);
  });
  it('lets the redeemed user sign out under their own fence', async () => {
    const { base, nuxtApp, client, fenced } = setup();
    await runHandoff(nuxtApp, '#tracker_token=otp-hash-out&tracker_state=nonce-1');
    fetchMock.mockImplementation(async () => new Response(null, { status: 204 }));
    await fenced.withOwnerFence(NEW_USER, () => client.auth.signOut({ scope: 'global' }));
    expect(base.values.has(STORAGE_KEY)).toBe(false);
  });
  it('stores no session when the token is rejected by the auth server', async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse(403, {
        code: 403,
        error_code: 'otp_expired',
        msg: 'Email link is invalid or has expired',
      })
    );
    const { base, nuxtApp } = setup();
    await expect(
      runHandoff(nuxtApp, '#tracker_token=expired-hash&tracker_state=nonce-1')
    ).resolves.toBeUndefined();
    expect(base.values.has(STORAGE_KEY)).toBe(false);
    expect(window.location.hash).toBe('');
  });
  it('survives an unreachable auth server and still strips the token from the URL', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const { base, nuxtApp } = setup();
    await expect(
      runHandoff(nuxtApp, '#tracker_token=net-down-hash&tracker_state=nonce-1')
    ).resolves.toBeUndefined();
    expect(base.values.has(STORAGE_KEY)).toBe(false);
    expect(window.location.hash).toBe('');
  });
  it('survives a pending OAuth callback during readiness without redeeming or leaking the token', async () => {
    const { SupabaseCallbackPendingError } = await import('@/utils/supabaseReadiness');
    const { nuxtApp } = setup();
    nuxtApp.$supabase.ready.mockRejectedValueOnce(new SupabaseCallbackPendingError());
    await expect(
      runHandoff(nuxtApp, '#tracker_token=pending-hash&tracker_state=nonce-1')
    ).resolves.toBeUndefined();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/auth/v1/verify'))).toBe(
      false
    );
    expect(window.location.hash).toBe('');
  });
});
