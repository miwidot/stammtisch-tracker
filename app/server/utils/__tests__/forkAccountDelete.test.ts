// @vitest-environment happy-dom
import { mockNuxtImport } from '@nuxt/test-utils/runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { H3Event } from 'h3';
const SECRET = 's'.repeat(40);
const USER_ID = '0b7c1c9e-3f0a-4b6e-8c1d-2a9e5d7f1a11';
const runtimeConfig: Record<string, unknown> = {};
const loggerMock = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
vi.mock('@/server/utils/logger', () => ({ createLogger: () => loggerMock }));
vi.mock('h3', async () => {
  const actual = await vi.importActual<typeof import('h3')>('h3');
  return {
    ...actual,
    getRequestHeader: (event: FakeEvent, name: string) => event.headers[name.toLowerCase()],
    readRawBody: async (event: FakeEvent) => event.rawBody,
  };
});
mockNuxtImport('useRuntimeConfig', () => () => runtimeConfig);
interface FakeEvent {
  method: string;
  headers: Record<string, string>;
  rawBody?: string;
}
const fetchMock = vi.fn();
const rpcOk = (body: unknown) =>
  ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
  }) as Response;
function makeEvent(overrides: Partial<FakeEvent> & { auth?: string | null; body?: unknown } = {}) {
  const headers: Record<string, string> = { ...(overrides.headers ?? {}) };
  if (overrides.auth !== null) headers.authorization = overrides.auth ?? `Bearer ${SECRET}`;
  const rawBody =
    overrides.rawBody ??
    (overrides.body === undefined
      ? JSON.stringify({ userId: USER_ID })
      : JSON.stringify(overrides.body));
  return {
    method: overrides.method ?? 'POST',
    headers,
    rawBody,
  } as FakeEvent as unknown as H3Event;
}
const call = async (event: H3Event) => {
  const { handleForkAccountDelete } = await import('@/server/utils/forkAccountDelete');
  return handleForkAccountDelete(event);
};
describe('fork account deletion (main site -> tracker)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    Object.values(loggerMock).forEach((fn) => fn.mockReset());
    runtimeConfig.forkAccountDeleteSecret = SECRET;
    runtimeConfig.supabaseUrl = 'https://tracker.example.test';
    runtimeConfig.supabaseServiceKey = 'service-key';
  });
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });
  describe('authentication and authorization', () => {
    it('answers 401 without any credentials and never reaches the database', async () => {
      const result = await call(makeEvent({ auth: null }));
      expect(result.status).toBe(401);
      expect(result.headers?.['WWW-Authenticate']).toBe('Bearer');
      expect(fetchMock).not.toHaveBeenCalled();
    });
    it.each(['Basic abc', 'Bearer', 'Bearer ', 'token-only', `Bearer ${SECRET} extra`])(
      'answers 401 for a malformed Authorization header %j',
      async (auth) => {
        expect((await call(makeEvent({ auth }))).status).toBe(401);
        expect(fetchMock).not.toHaveBeenCalled();
      }
    );
    it('answers 403 for a wrong secret and logs it without the secret', async () => {
      const result = await call(makeEvent({ auth: `Bearer ${'x'.repeat(40)}` }));
      expect(result.status).toBe(403);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(JSON.stringify(loggerMock.warn.mock.calls)).not.toContain(SECRET);
    });
    it('answers 403 for the secret with different casing, a prefix, or a longer value', async () => {
      for (const attempt of [SECRET.toUpperCase(), SECRET.slice(0, -1), `${SECRET}x`]) {
        expect((await call(makeEvent({ auth: `Bearer ${attempt}` }))).status).toBe(403);
      }
      expect(fetchMock).not.toHaveBeenCalled();
    });
    it('does not accept a Supabase-style service key as the secret', async () => {
      const result = await call(makeEvent({ auth: 'Bearer service-key' }));
      expect(result.status).toBe(403);
    });
    it.each([
      ['unset', ''],
      ['too short', 'short-secret'],
    ])(
      'fails closed with 503 when the secret is %s, even for a matching header',
      async (_n, secret) => {
        runtimeConfig.forkAccountDeleteSecret = secret;
        const result = await call(makeEvent({ auth: `Bearer ${secret || 'anything'}` }));
        expect(result.status).toBe(503);
        expect(loggerMock.error).toHaveBeenCalled();
        expect(fetchMock).not.toHaveBeenCalled();
      }
    );
    it.each([
      ['supabaseUrl', ''],
      ['supabaseUrl', 'http://insecure.example.test'],
      ['supabaseServiceKey', ''],
    ])('fails closed with 503 when %s is %j', async (key, value) => {
      runtimeConfig[key] = value;
      expect((await call(makeEvent())).status).toBe(503);
      expect(fetchMock).not.toHaveBeenCalled();
    });
    it.each(['GET', 'PUT', 'DELETE', 'PATCH'])(
      'rejects %s with 405 before any auth work',
      async (method) => {
        const result = await call(makeEvent({ method, auth: null }));
        expect(result.status).toBe(405);
        expect(result.headers?.Allow).toBe('POST');
      }
    );
  });
  describe('abuse limits', () => {
    afterEach(() => {
      vi.useRealTimers();
    });
    it('answers 429 with Retry-After after 20 requests per minute, before touching the secret or the database', async () => {
      fetchMock.mockResolvedValue(rpcOk({ deleted: false, reason: 'not_found' }));
      for (let i = 0; i < 20; i += 1) expect((await call(makeEvent())).status).toBe(200);
      const limited = await call(makeEvent());
      expect(limited.status).toBe(429);
      expect(Number(limited.headers?.['Retry-After'])).toBeGreaterThanOrEqual(1);
      expect(Number(limited.headers?.['Retry-After'])).toBeLessThanOrEqual(60);
      expect(fetchMock).toHaveBeenCalledTimes(20);
    });
    it('counts wrong-secret guesses too, so guessing is throttled', async () => {
      for (let i = 0; i < 20; i += 1) {
        expect((await call(makeEvent({ auth: `Bearer ${'x'.repeat(40)}` }))).status).toBe(403);
      }
      expect((await call(makeEvent({ auth: `Bearer ${'x'.repeat(40)}` }))).status).toBe(429);
      // Even the right secret is refused while the window is exhausted.
      expect((await call(makeEvent())).status).toBe(429);
    });
    it('allows requests again after the window passes', async () => {
      vi.useFakeTimers();
      fetchMock.mockResolvedValue(rpcOk({ deleted: false, reason: 'not_found' }));
      for (let i = 0; i < 21; i += 1) await call(makeEvent());
      expect((await call(makeEvent())).status).toBe(429);
      vi.advanceTimersByTime(61_000);
      expect((await call(makeEvent())).status).toBe(200);
    });
    it('logs a wrong secret once per minute and counts what it suppressed', async () => {
      vi.useFakeTimers();
      for (let i = 0; i < 10; i += 1) {
        expect((await call(makeEvent({ auth: `Bearer ${'y'.repeat(40)}` }))).status).toBe(403);
      }
      expect(loggerMock.warn).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(61_000);
      await call(makeEvent({ auth: `Bearer ${'y'.repeat(40)}` }));
      expect(loggerMock.warn).toHaveBeenCalledTimes(2);
      expect(loggerMock.warn.mock.calls[1]?.[1]).toEqual({ suppressedSinceLastLog: 9 });
    });
    it('never puts the guessed or the real secret into the log', async () => {
      await call(makeEvent({ auth: 'Bearer guessed-secret-value-guessed-secret-value' }));
      const logged = JSON.stringify(loggerMock.warn.mock.calls);
      expect(logged).not.toContain('guessed-secret-value');
      expect(logged).not.toContain(SECRET);
    });
  });
  describe('input validation', () => {
    it.each([
      ['empty body', { rawBody: '' }],
      ['invalid JSON', { rawBody: '{nope' }],
      ['array body', { body: [USER_ID] }],
      ['null body', { body: null }],
      ['missing userId', { body: {} }],
      ['numeric userId', { body: { userId: 42 } }],
      ['non-uuid userId', { body: { userId: 'not-a-uuid' } }],
      ['sql injection', { body: { userId: `${USER_ID}' OR 1=1;--` } }],
      ['uuid with path suffix', { body: { userId: `${USER_ID}/../x` } }],
      ['array userId', { body: { userId: [USER_ID] } }],
      ['nested userId', { body: { userId: { id: USER_ID } } }],
    ])('answers 400 for %s', async (_name, overrides) => {
      const result = await call(makeEvent(overrides));
      expect(result.status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    });
    it('answers 413 for an oversized body declared by Content-Length', async () => {
      const result = await call(makeEvent({ headers: { 'content-length': '2048' } }));
      expect(result.status).toBe(413);
      expect(fetchMock).not.toHaveBeenCalled();
    });
    it('answers 413 for an oversized body without Content-Length', async () => {
      const result = await call(
        makeEvent({ rawBody: JSON.stringify({ userId: USER_ID, pad: 'x'.repeat(5000) }) })
      );
      expect(result.status).toBe(413);
    });
    it('ignores prototype-pollution keys and only uses a valid userId', async () => {
      fetchMock.mockResolvedValueOnce(rpcOk({ deleted: true }));
      const result = await call(
        makeEvent({ rawBody: `{"__proto__":{"admin":true},"userId":"${USER_ID}"}` })
      );
      expect(result.status).toBe(200);
      expect(({} as { admin?: boolean }).admin).toBeUndefined();
    });
  });
  describe('deletion', () => {
    it('calls the fork_delete_account RPC with the service key and the normalized user id', async () => {
      fetchMock.mockResolvedValueOnce(rpcOk({ deleted: true }));
      const upper = USER_ID.toUpperCase();
      const result = await call(makeEvent({ body: { userId: upper } }));
      expect(result).toEqual({ status: 200, body: { ok: true, deleted: true } });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://tracker.example.test/rest/v1/rpc/fork_delete_account');
      expect(init.method).toBe('POST');
      expect(JSON.parse(String(init.body))).toEqual({ p_user_id: USER_ID });
      const headers = init.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer service-key');
    });
    it('accepts the loopback http Supabase URL used on the box (no not_configured)', async () => {
      runtimeConfig.supabaseUrl = 'http://127.0.0.1:8200';
      fetchMock.mockResolvedValueOnce(rpcOk({ deleted: true }));
      const result = await call(makeEvent());
      expect(result).toEqual({ status: 200, body: { ok: true, deleted: true } });
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toBe('http://127.0.0.1:8200/rest/v1/rpc/fork_delete_account');
    });
    it.each([
      'http://127.0.0.1.evil.com:8200',
      'http://localhost.evil.com',
      'http://user:pw@127.0.0.1:8200',
      'http://0.0.0.0:8200',
    ])('still fails closed with 503 for %s and never sends the service key', async (url) => {
      runtimeConfig.supabaseUrl = url;
      expect((await call(makeEvent())).status).toBe(503);
      expect(fetchMock).not.toHaveBeenCalled();
    });
    it('is an idempotent no-op for an unknown or already deleted user', async () => {
      fetchMock.mockResolvedValue(rpcOk({ deleted: false, reason: 'not_found' }));
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const result = await call(makeEvent());
        expect(result).toEqual({
          status: 200,
          body: { ok: true, deleted: false, reason: 'not_found' },
        });
      }
    });
    it('reports 409 and a retryable reason when another deletion holds the lease', async () => {
      fetchMock.mockResolvedValueOnce(
        rpcOk({ deleted: false, reason: 'claim_not_acquired', status: 'in_progress' })
      );
      const result = await call(makeEvent());
      expect(result.status).toBe(409);
      expect(result.body).toEqual({ ok: false, deleted: false, reason: 'in_progress' });
      expect(loggerMock.warn).toHaveBeenCalled();
    });
    it('reports 409 storage_owner (not retryable) for an account that owns Storage data', async () => {
      fetchMock.mockResolvedValueOnce(rpcOk({ deleted: false, reason: 'storage_owner' }));
      const result = await call(makeEvent());
      expect(result.status).toBe(409);
      expect(result.body).toEqual({ ok: false, deleted: false, reason: 'storage_owner' });
    });
    it('reports 502 and logs when the database call fails (partial failure rolls back)', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => '{"code":"23514","message":"account_deletion_subscription_active"}',
      } as Response);
      const result = await call(makeEvent());
      expect(result.status).toBe(502);
      expect(result.body).toEqual({ ok: false, error: 'delete_failed' });
      expect(loggerMock.error).toHaveBeenCalled();
      expect(JSON.stringify(result.body)).not.toContain('23514');
      expect(JSON.stringify(result.body)).not.toContain('service-key');
    });
    it('reports 502 on a network error or timeout', async () => {
      fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const result = await call(makeEvent());
      expect(result.status).toBe(502);
      expect(loggerMock.error).toHaveBeenCalled();
    });
    it.each([[null], ['ok'], [{}], [{ deleted: 'yes' }], [[true]]])(
      'reports 502 for a malformed RPC answer %j instead of claiming success',
      async (answer) => {
        fetchMock.mockResolvedValueOnce(rpcOk(answer));
        const result = await call(makeEvent());
        expect(result.status).toBe(502);
        expect(result.body.deleted).toBeUndefined();
      }
    );
    it('treats an empty 204 RPC answer as a failure, not as a deletion', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, status: 204, text: async () => '' } as Response);
      expect((await call(makeEvent())).status).toBe(502);
    });
  });
});
