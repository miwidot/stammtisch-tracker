// @vitest-environment happy-dom
import { mockNuxtImport } from '@nuxt/test-utils/runtime';
import { afterEach, describe, expect, it, vi } from 'vitest';
const runtimeConfig = vi.hoisted(() => ({ public: { allowIndexing: false as unknown } }));
mockNuxtImport('useRuntimeConfig', () => () => runtimeConfig);
afterEach(() => vi.unstubAllGlobals());
const stubNitro = (allowIndexing: unknown = false) => {
  vi.stubGlobal('defineNitroPlugin', (plugin: unknown) => plugin);
  runtimeConfig.public.allowIndexing = allowIndexing;
};
describe('client document HTML metadata', () => {
  it.each(['/tasks/', '/tasks/?search=example', '/resources/tarkovmonitor/'])(
    'leaves prerendered public head tags untouched for %s',
    async (path) => {
      stubNitro();
      const { default: plugin } = await import('@/server/plugins/route-seo');
      const hooks: Record<string, (...args: unknown[]) => unknown> = {};
      await plugin({
        hooks: {
          hook: (name: string, callback: (...args: unknown[]) => unknown) => {
            hooks[name] = callback;
          },
        },
      } as never);
      const html = { head: ['<title>Existing public title</title>'], body: [] };
      hooks['render:html']!(html, { event: { path } });
      expect(html.head).toEqual(['<title>Existing public title</title>']);
    }
  );
  it('renders readable 404 content inside an attributed Nuxt root and marks it noindex', async () => {
    stubNitro();
    const { default: plugin } = await import('@/server/plugins/route-seo');
    const hooks: Record<string, (...args: unknown[]) => unknown> = {};
    await plugin({
      hooks: {
        hook: (name: string, callback: (...args: unknown[]) => unknown) => {
          hooks[name] = callback;
        },
      },
    } as never);
    const html = {
      head: [],
      body: ['<div id="__nuxt" class="isolate"></div><div id="teleports"></div>'],
    };
    hooks['render:html']!(html, { event: { path: '/404.html' } });
    expect(html.head.join('')).toContain('name="robots" content="noindex, nofollow"');
    expect(html.body[0]).toContain('<h1 class="text-2xl font-bold">Page Not Found</h1>');
    expect(html.body[0]).toMatch(/^<div id="__nuxt" class="isolate"><main/);
  });
  describe('fork indexing policy for client documents', () => {
    const render = async (allowIndexing: unknown, path: string) => {
      stubNitro(allowIndexing);
      const { default: plugin } = await import('@/server/plugins/route-seo');
      const hooks: Record<string, (...args: unknown[]) => unknown> = {};
      await plugin({
        hooks: { hook: (name: string, cb: (...args: unknown[]) => unknown) => (hooks[name] = cb) },
      } as never);
      const html = { head: [] as string[], body: [] as string[] };
      hooks['render:html']!(html, { event: { path } });
      return html.head.join('\n');
    };
    it.each(['/login', '/settings', '/not-found'])(
      'emits noindex and no upstream canonical, og:url or JSON-LD for %s by default',
      async (path) => {
        const head = await render(false, path);
        expect(head).toContain('name="robots" content="noindex, nofollow"');
        expect(head).not.toContain('rel="canonical"');
        expect(head).not.toContain('tarkovtracker.org');
        expect(head).not.toContain('og:url');
        expect(head).not.toContain('application/ld+json');
      }
    );
    it.each([undefined, null, 'false', '', 0, 'TRUE', 1])(
      'stays noindex for the non-true switch value %j',
      async (value) => {
        expect(await render(value, '/login')).not.toContain('rel="canonical"');
      }
    );
    it('restores upstream canonical and JSON-LD when indexing is switched on', async () => {
      const head = await render(true, '/login');
      expect(head).toContain('<link rel="canonical" href="https://tarkovtracker.org/login">');
      expect(head).toContain('application/ld+json');
    });
  });
});
