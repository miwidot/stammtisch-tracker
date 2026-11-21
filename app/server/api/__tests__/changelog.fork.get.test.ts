// @vitest-environment happy-dom
import { mockNuxtImport } from '@nuxt/test-utils/runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { H3Event } from 'h3';
const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  fetch: vi.fn(),
  config: {
    githubTimeoutMs: 1000,
    githubToken: '',
    public: {
      appUrl: 'https://tracker.test',
      githubOwner: 'owner',
      githubRepo: 'repo',
      upstreamGithubEnabled: true,
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
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const releases = (days: string[]) =>
  days.map((day, index) => ({
    tag_name: `v${index}`,
    published_at: `${day}T12:00:00Z`,
    body: '- Improved maps',
  }));
const load = async () => (await import('@/server/api/changelog.get')).default;
const mockUpstream = (days: string[]) =>
  mocks.fetch.mockImplementation(async (url: string) => {
    if (url.includes('/releases?')) return json(releases(days));
    if (url.includes('/compare/')) return json({ files: [] });
    if (url.includes('/commits?')) return json([]);
    throw new Error(`Unexpected request: ${url}`);
  });
describe('changelog endpoint with fork entries', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.query.mockReturnValue({ limit: 10, releases: 3 });
    mocks.fetch.mockReset();
    vi.stubGlobal('fetch', mocks.fetch);
    mockUpstream(['2026-11-14', '2026-11-06']);
  });
  it('puts the German fork entries first when lang=de', async () => {
    mocks.query.mockReturnValue({ limit: 10, releases: 3, lang: 'de' });
    const response = await (await load())(event);
    expect(response.items.slice(0, 2).map((item) => item.label)).toEqual([
      'Bitte Einstellungen prüfen',
      'Stammtisch-Update',
    ]);
    expect(response.items.slice(2).map((item) => item.label)).toEqual(['v0', 'v1']);
    expect(response.error).toBeUndefined();
  });
  it.each([undefined, 'en', 'fr', ['en', 'de'], '<script>'])(
    'serves the English entries for lang=%j',
    async (lang) => {
      mocks.query.mockReturnValue({ limit: 10, releases: 3, lang });
      const response = await (await load())(event);
      expect(response.items[0]?.label).toBe('Please check your settings');
    }
  );
  it('still serves the fork entries, without an error, when GitHub is unreachable', async () => {
    mocks.fetch.mockImplementation(async () => json({ message: 'down' }, 500));
    mocks.query.mockReturnValue({ limit: 10, lang: 'de' });
    const response = await (await load())(event);
    expect(response.error).toBeUndefined();
    expect(response.items.map((item) => item.label)).toEqual([
      'Bitte Einstellungen prüfen',
      'Stammtisch-Update',
    ]);
    expect(response.hasMore).toBe(false);
  });
  it('counts fork entries against the limit and reports more pages', async () => {
    mocks.query.mockReturnValue({ limit: 3, releases: 3, lang: 'de' });
    const response = await (await load())(event);
    expect(response.items).toHaveLength(3);
    expect(response.items[2]?.label).toBe('v0');
    expect(response.hasMore).toBe(true);
  });
  it('limit=1 returns a single fork entry and hasMore', async () => {
    mocks.query.mockReturnValue({ limit: 1, releases: 1, lang: 'de' });
    const response = await (await load())(event);
    expect(response.items).toHaveLength(1);
    expect(response.hasMore).toBe(true);
  });
  it('does not leak fork entries into the upstream response cache', async () => {
    mocks.query.mockReturnValue({ limit: 10, releases: 3, lang: 'de' });
    const handler = await load();
    await handler(event);
    mocks.query.mockReturnValue({ limit: 10, releases: 3, lang: 'en' });
    const second = await handler(event);
    expect(second.items.filter((item) => item.label === 'Stammtisch update')).toHaveLength(1);
    expect(second.items.filter((item) => item.label === 'Stammtisch-Update')).toHaveLength(0);
    expect(second.items.filter((item) => item.label === 'v0')).toHaveLength(1);
  });
});
