// @vitest-environment node
import { createServer, type Server } from 'node:http';
import { mockNuxtImport } from '@nuxt/test-utils/runtime';
import { createApp, toNodeListener } from 'h3';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
const runtimeConfig = vi.hoisted(() => ({
  public: {
    allowIndexing: false as unknown,
    legalPrivacyUrl: undefined as unknown,
    legalTermsUrl: undefined as unknown,
  },
}));
mockNuxtImport('useRuntimeConfig', () => () => runtimeConfig);
let server: Server;
let base = '';
let reached = false;
beforeAll(async () => {
  const { default: indexingPolicy } = await import('../02.fork-indexing-policy');
  const { default: legalRedirect } = await import('../03.fork-legal-redirect');
  const app = createApp();
  app.use(indexingPolicy);
  app.use(legalRedirect);
  // Stands in for the rest of the app: reached only when the redirect did not answer.
  app.use(() => {
    reached = true;
    return 'app';
  });
  server = createServer(toNodeListener(app));
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => {
  server.close();
});
beforeEach(() => {
  reached = false;
  runtimeConfig.public.allowIndexing = false;
  runtimeConfig.public.legalPrivacyUrl = undefined;
  runtimeConfig.public.legalTermsUrl = undefined;
});
const get = (path: string, init: RequestInit = {}) =>
  fetch(`${base}${path}`, { redirect: 'manual', ...init });
const PRIVACY = 'https://tarkov-stammtisch.de/datenschutz';
const TERMS = 'https://tarkov-stammtisch.de/nutzungsbedingungen';
describe('upstream legal routes redirect to the Stammtisch pages', () => {
  it.each([
    ['/privacy', PRIVACY],
    ['/terms-of-service', TERMS],
  ])('%s answers 302 with the configured default target', async (path, target) => {
    const res = await get(path);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(target);
    expect(reached).toBe(false);
  });
  it.each([
    '/privacy/',
    '/privacy?lang=de',
    '/privacy/?utm=x&next=https://evil.example',
    '/Privacy',
    '//privacy',
    '/PRIVACY/',
    '/privacy#frag',
  ])('variant %s redirects to the privacy target', async (path) => {
    const res = await get(path);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(PRIVACY);
  });
  it.each(['/terms-of-service/', '/terms-of-service?x=1', '/Terms-Of-Service'])(
    'variant %s redirects to the terms target',
    async (path) => {
      const res = await get(path);
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBe(TERMS);
    }
  );
  it('answers HEAD the same way', async () => {
    const res = await get('/privacy', { method: 'HEAD' });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(PRIVACY);
  });
  it('uses 302, never a cacheable 301', async () => {
    const res = await get('/privacy');
    expect(res.status).not.toBe(301);
    expect(res.headers.get('cache-control') ?? '').not.toMatch(/max-age=\d{3,}/);
  });
  it('keeps the noindex header on the redirect response', async () => {
    const res = await get('/privacy');
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });
  it('does not touch other routes or look-alikes', async () => {
    for (const path of ['/', '/tasks', '/privacy-policy', '/privacy/extra', '/api/privacy']) {
      reached = false;
      const res = await get(path);
      expect(res.status, path).toBe(200);
      expect(reached, path).toBe(true);
    }
  });
  it('does not redirect writes', async () => {
    const res = await get('/privacy', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(reached).toBe(true);
  });
});
describe('redirect target comes from config only', () => {
  it('honours a runtime config override', async () => {
    runtimeConfig.public.legalPrivacyUrl = 'https://dev.tarkov-stammtisch.de/datenschutz';
    runtimeConfig.public.legalTermsUrl = 'https://dev.tarkov-stammtisch.de/nutzungsbedingungen';
    expect((await get('/privacy')).headers.get('location')).toBe(
      'https://dev.tarkov-stammtisch.de/datenschutz'
    );
    expect((await get('/terms-of-service')).headers.get('location')).toBe(
      'https://dev.tarkov-stammtisch.de/nutzungsbedingungen'
    );
  });
  it.each([
    'javascript:alert(1)',
    'http://insecure.example/x',
    '//evil.example',
    'https://u:p@evil.example/',
  ])('ignores an unsafe configured value %s and uses the default', async (value) => {
    runtimeConfig.public.legalPrivacyUrl = value;
    expect((await get('/privacy')).headers.get('location')).toBe(PRIVACY);
  });
  it('is not steerable by query, headers or host (no open redirect)', async () => {
    const attempts = [
      '/privacy?url=https://evil.example',
      '/privacy?redirect=//evil.example&next=https://evil.example&to=https://evil.example',
    ];
    for (const path of attempts) {
      const res = await get(path, {
        headers: {
          Host: 'evil.example',
          Referer: 'https://evil.example/',
          'X-Forwarded-Host': 'evil.example',
          'X-Original-URL': 'https://evil.example/',
        },
      });
      expect(res.headers.get('location')).toBe(PRIVACY);
    }
  });
});
