// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mockNuxtImport } from '@nuxt/test-utils/runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const runtimeConfig = vi.hoisted(() => ({ public: { allowIndexing: false as unknown } }));
const headers = vi.hoisted(() => ({ set: {} as Record<string, string> }));
mockNuxtImport('useRuntimeConfig', () => () => runtimeConfig);
vi.mock('h3', () => ({
  defineEventHandler: (handler: unknown) => handler,
  setResponseHeader: (_event: unknown, name: string, value: string) => {
    headers.set[name] = value;
  },
}));
const run = async () => {
  const { default: handler } = await import('../02.fork-indexing-policy');
  return (handler as (event: unknown) => unknown)({});
};
describe('fork indexing policy middleware', () => {
  beforeEach(() => {
    headers.set = {};
    runtimeConfig.public.allowIndexing = false;
  });
  it('sends X-Robots-Tag noindex, nofollow on every response by default', async () => {
    await run();
    expect(headers.set['X-Robots-Tag']).toBe('noindex, nofollow');
  });
  it.each([undefined, null, 'false', '', 0, 'TRUE'])(
    'still sends it for the non-true switch value %j',
    async (value) => {
      runtimeConfig.public.allowIndexing = value;
      await run();
      expect(headers.set['X-Robots-Tag']).toBe('noindex, nofollow');
    }
  );
  it('sends nothing when indexing is switched on', async () => {
    runtimeConfig.public.allowIndexing = true;
    await run();
    expect(headers.set).toEqual({});
  });
});
describe('robots.txt shipped in public/', () => {
  it('disallows everything and lists no sitemap or allow rule', () => {
    const text = readFileSync(resolve(process.cwd(), 'public/robots.txt'), 'utf8');
    expect(text).toMatch(/^User-agent: \*$/im);
    expect(text).toMatch(/^Disallow: \/$/m);
    expect(text).not.toMatch(/^Allow:/im);
    expect(text).not.toMatch(/sitemap/i);
    expect(text).not.toContain('tarkovtracker.org');
  });
});
