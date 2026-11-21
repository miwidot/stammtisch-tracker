// @vitest-environment node
import { createServer, request as httpRequest, type Server } from 'node:http';
import { mockNuxtImport } from '@nuxt/test-utils/runtime';
import { createApp, toNodeListener } from 'h3';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
const SECRET = 's'.repeat(40);
const USER_ID = '0b7c1c9e-3f0a-4b6e-8c1d-2a9e5d7f1a11';
const SUPABASE = 'https://tracker.example.test';
const runtimeConfig = vi.hoisted(() => ({}) as Record<string, unknown>);
const loggerMock = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));
const rateLimit = vi.hoisted(() => ({ consume: vi.fn() }));
vi.mock('@/server/utils/logger', () => ({ createLogger: () => loggerMock }));
vi.mock('@/server/utils/sharedEdgeStore', async () => {
  const actual = await vi.importActual<typeof import('@/server/utils/sharedEdgeStore')>(
    '@/server/utils/sharedEdgeStore'
  );
  return {
    ...actual,
    consumeSharedRateLimitWithReset: (...args: unknown[]) => {
      rateLimit.consume(...args);
      return Promise.resolve({ allowed: true, resetAt: Date.now() + 60_000 });
    },
  };
});
mockNuxtImport('useRuntimeConfig', () => () => runtimeConfig);
let server: Server;
let port = 0;
let peer: string | undefined;
let reached = false;
const realFetch = globalThis.fetch;
const supabaseCalls = vi.fn();
beforeAll(async () => {
  const { default: gate } = await import('../01.fork-account-delete');
  const app = createApp();
  // Test-only: lets a request claim a non-loopback TCP peer, as a remote caller would have.
  app.use((event) => {
    // Sockets are reused between requests, so always reset the override.
    if (peer === undefined) {
      Reflect.deleteProperty(event.node.req.socket, 'remoteAddress');
    } else {
      Object.defineProperty(event.node.req.socket, 'remoteAddress', {
        value: peer,
        configurable: true,
      });
    }
  });
  app.use(gate);
  app.use(() => {
    reached = true;
    return 'app';
  });
  server = createServer(toNodeListener(app));
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  port = (server.address() as AddressInfo).port;
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith(SUPABASE)) {
      supabaseCalls(url);
      return Promise.resolve(
        new Response(JSON.stringify({ deleted: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      );
    }
    return realFetch(input, init);
  });
});
afterAll(() => {
  server.close();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  peer = undefined;
  reached = false;
  rateLimit.consume.mockClear();
  supabaseCalls.mockClear();
  Object.values(loggerMock).forEach((fn) => fn.mockClear());
  runtimeConfig.forkAccountDeleteSecret = SECRET;
  runtimeConfig.supabaseUrl = SUPABASE;
  runtimeConfig.supabaseServiceKey = 'service-key';
  runtimeConfig.apiProtection = { trustProxy: true };
});
// node:http (not fetch) so forbidden or empty headers are sent exactly as given.
function send(
  path: string,
  headers: Record<string, string> = {},
  secret: string = SECRET
): Promise<{ status: number; body: string }> {
  const body = JSON.stringify({ userId: USER_ID });
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: '127.0.0.1',
        port,
        path,
        method: 'POST',
        headers: {
          authorization: `Bearer ${secret}`,
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
          ...headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
      }
    );
    req.on('error', reject);
    req.end(body);
  });
}
const PATH = '/api/fork/account-delete';
const FORWARDING = [
  'X-Forwarded-For',
  'X-Real-IP',
  'CF-Connecting-IP',
  'Forwarded',
  'X-Forwarded-Host',
  'X-Forwarded-Proto',
  'True-Client-IP',
];
function expectNoDeleteLogic() {
  expect(supabaseCalls).not.toHaveBeenCalled();
  expect(rateLimit.consume).not.toHaveBeenCalled();
  expect(reached).toBe(false);
}
describe('fork account deletion is reachable only by direct loopback callers', () => {
  it.each([undefined, '127.0.0.1', '127.1.2.3', '::1', '::ffff:127.0.0.1', '::FFFF:127.9.9.9'])(
    'loopback peer %s with a valid secret and no forwarding headers is served',
    async (address) => {
      peer = address;
      const res = await send(PATH);
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ ok: true, deleted: true });
      expect(supabaseCalls).toHaveBeenCalledTimes(1);
    }
  );
  it.each([
    '203.0.113.9',
    '10.0.0.5',
    '192.168.1.10',
    '2001:db8::1',
    '::ffff:203.0.113.9',
    '::',
    '0.0.0.0',
    '128.0.0.1',
    '126.255.255.255',
    '127.0.0.256',
    '127.0.0.1.evil',
    '::ffff:127.0.0',
    'fe80::1',
    '',
  ])('non-loopback peer %j answers 404 even with a valid secret', async (address) => {
    peer = address;
    const res = await send(PATH);
    expect(res.status).toBe(404);
    expect(res.body).not.toContain('forbidden');
    expectNoDeleteLogic();
  });
  it.each(FORWARDING)('loopback peer plus %s answers 404', async (name) => {
    const res = await send(PATH, { [name]: '127.0.0.1' });
    expect(res.status).toBe(404);
    expectNoDeleteLogic();
  });
  it.each(FORWARDING)('loopback peer plus an empty %s answers 404', async (name) => {
    const res = await send(PATH, { [name]: '' });
    expect(res.status).toBe(404);
    expectNoDeleteLogic();
  });
  it('a remote peer spoofing loopback via headers is still rejected, ignoring API_TRUST_PROXY', async () => {
    peer = '203.0.113.9';
    const res = await send(PATH, {
      'X-Forwarded-For': '127.0.0.1',
      'X-Real-IP': '127.0.0.1',
      'CF-Connecting-IP': '127.0.0.1',
    });
    expect(res.status).toBe(404);
    expectNoDeleteLogic();
  });
  it('rejects before the secret is looked at: a wrong secret from a remote peer is 404, not 403', async () => {
    peer = '203.0.113.9';
    const res = await send(PATH, {}, 'x'.repeat(40));
    expect(res.status).toBe(404);
    expectNoDeleteLogic();
    const warnings = JSON.stringify(loggerMock.warn.mock.calls);
    expect(warnings).not.toContain('wrong secret');
  });
  it('logs only header names and a flag, never values or the secret', async () => {
    await send(PATH, { 'X-Forwarded-For': '198.51.100.77' });
    const logged = JSON.stringify(loggerMock.warn.mock.calls);
    expect(logged).toContain('x-forwarded-for');
    expect(logged).not.toContain('198.51.100.77');
    expect(logged).not.toContain(SECRET);
  });
  it('keeps answering a wrong secret with 403 for a direct loopback caller', async () => {
    const res = await send(PATH, {}, 'x'.repeat(40));
    expect(res.status).toBe(403);
    expect(rateLimit.consume).toHaveBeenCalledTimes(1);
  });
  it.each([
    '/api/fork/account-delete/',
    '/API/FORK/ACCOUNT-DELETE',
    '/Api/Fork/Account-Delete/',
    '/api//fork/account-delete',
    '/api/fork/account-delete//',
    '/api/fork/account%2Ddelete',
    '/api%2Ffork%2Faccount-delete',
    '/%61pi/fork/account-delete',
    '/api/fork%252Faccount-delete',
  ])('path variant %s never reaches the delete logic, even from loopback', async (path) => {
    const res = await send(path);
    expectNoDeleteLogic();
    expect(res.status).toBe(404);
  });
  // The query string is not part of the path and h3 folds a leading double slash into the same
  // route, so these ARE the real endpoint: served for a direct caller, gated for everyone else.
  it.each(['/api/fork/account-delete?x=1', '//api/fork/account-delete'])(
    '%s is the real endpoint: served to loopback, 404 for a forwarded request',
    async (path) => {
      expect((await send(path)).status).toBe(200);
      supabaseCalls.mockClear();
      expect((await send(path, { 'X-Forwarded-For': '1.2.3.4' })).status).toBe(404);
      expect(supabaseCalls).not.toHaveBeenCalled();
    }
  );
  it.each(['/api/fork/account-delete/', '/API/FORK/ACCOUNT-DELETE', '//api/fork/account-delete'])(
    'path variant %s from a remote peer answers 404 as well',
    async (path) => {
      peer = '203.0.113.9';
      const res = await send(path, { 'X-Forwarded-For': '1.2.3.4' });
      expect(res.status).toBe(404);
      expectNoDeleteLogic();
    }
  );
  it.each(['/api/fork/account-delete-all', '/api/fork', '/api/progress', '/'])(
    'does not touch unrelated route %s',
    async (path) => {
      peer = '203.0.113.9';
      const res = await send(path, { 'X-Forwarded-For': '1.2.3.4' });
      expect(res.status).toBe(200);
      expect(reached).toBe(true);
    }
  );
  it('does not touch unrelated routes', async () => {
    const res = await send('/api/other');
    expect(res.status).toBe(200);
    expect(reached).toBe(true);
  });
});
