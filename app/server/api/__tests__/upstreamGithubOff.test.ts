// @vitest-environment happy-dom
import { mockNuxtImport } from '@nuxt/test-utils/runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { H3Event } from 'h3';
const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  config: {
    githubTimeoutMs: 1000,
    githubToken: 'token-that-must-never-be-sent',
    githubContributorsExclude: '',
    githubContributorsCacheTtlMs: 1000,
    public: {
      appUrl: 'https://tracker.test',
      githubOwner: 'tarkovtracker-org',
      githubRepo: 'TarkovTracker',
      upstreamGithubEnabled: false as unknown,
    },
  },
}));
vi.mock('h3', async (original) => ({
  ...(await original<typeof import('h3')>()),
  getQuery: mocks.query,
  setResponseHeaders: vi.fn(),
}));
mockNuxtImport('useRuntimeConfig', () => () => mocks.config);
vi.mock('@/server/utils/sharedEdgeStore', () => ({
  getSharedCache: () => null,
  resolveSharedCacheOrigin: () => ({ host: 'tracker.test', protocol: 'https:' }),
}));
const event = {} as H3Event;
let hostFetch: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.resetModules();
  mocks.query.mockReturnValue({ limit: 10, lang: 'de' });
  mocks.config.public.upstreamGithubEnabled = false;
  hostFetch = vi.fn(async () => new Response('[]', { status: 200 }));
  vi.stubGlobal('fetch', hostFetch);
});
const OFF_VALUES = [false, undefined, null, 'true', 1, 'false', ''];
describe('upstream GitHub calls are off by default (fork)', () => {
  it.each(OFF_VALUES)(
    '/api/changelog serves only our entries and never calls GitHub (%j)',
    async (flag) => {
      mocks.config.public.upstreamGithubEnabled = flag;
      const { default: handler } = await import('@/server/api/changelog.get');
      const response = await handler(event);
      expect(hostFetch).not.toHaveBeenCalled();
      expect(response.error).toBeUndefined();
      expect(response.items.map((item) => item.label)).toEqual([
        'Bitte Einstellungen prüfen',
        'Stammtisch-Update',
      ]);
    }
  );
  it('/api/changelog still honours a small limit without GitHub', async () => {
    mocks.query.mockReturnValue({ limit: 1, lang: 'en' });
    const { default: handler } = await import('@/server/api/changelog.get');
    const response = await handler(event);
    expect(response.items).toHaveLength(1);
    expect(response.hasMore).toBe(true);
    expect(hostFetch).not.toHaveBeenCalled();
  });
  it.each(OFF_VALUES)(
    '/api/contributors answers 200-shaped data without GitHub (%j)',
    async (flag) => {
      mocks.config.public.upstreamGithubEnabled = flag;
      const { default: handler } = await import('@/server/api/contributors.get');
      const response = await handler(event);
      expect(response).toEqual({ items: [] });
      expect(hostFetch).not.toHaveBeenCalled();
    }
  );
  it('the flag set to exactly true brings the upstream request back', async () => {
    mocks.config.public.upstreamGithubEnabled = true;
    const { default: handler } = await import('@/server/api/contributors.get');
    await handler(event);
    expect(hostFetch).toHaveBeenCalledWith(
      expect.stringContaining(
        'https://api.github.com/repos/tarkovtracker-org/TarkovTracker/contributors'
      ),
      expect.any(Object)
    );
  });
});
