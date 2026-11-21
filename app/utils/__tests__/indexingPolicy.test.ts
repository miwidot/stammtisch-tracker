import { describe, expect, it } from 'vitest';
import {
  applyIndexingPolicy,
  isIndexingAllowed,
  NOINDEX_DIRECTIVE,
  robotsTxtAllowingIndexing,
} from '@/utils/indexingPolicy';
import { createRouteSeoHead, PUBLIC_SEO_ROUTES } from '@/utils/routeSeo';
describe('isIndexingAllowed', () => {
  it.each([
    [true, true],
    ['true', true],
    [false, false],
    ['false', false],
    [undefined, false],
    [null, false],
    ['', false],
    [1, false],
    ['TRUE', false],
    ['yes', false],
  ])('maps %j to %s', (value, expected) => {
    expect(isIndexingAllowed(value)).toBe(expected);
  });
});
describe('applyIndexingPolicy on the real per-route SEO head', () => {
  it.each(PUBLIC_SEO_ROUTES)(
    'turns the indexable public route %s into noindex without canonical, og:url or JSON-LD',
    (route) => {
      const original = createRouteSeoHead(route);
      expect(original.link.length + original.script.length).toBeGreaterThan(0);
      const head = applyIndexingPolicy(original, false);
      expect(head.meta.find((tag) => 'name' in tag && tag.name === 'robots')?.content).toBe(
        NOINDEX_DIRECTIVE
      );
      expect(head.link).toEqual([]);
      expect(head.script).toEqual([]);
      expect(JSON.stringify(head)).not.toContain('og:url');
      expect(JSON.stringify(head)).not.toContain('tarkovtracker.org');
    }
  );
  it('keeps title, description and social titles', () => {
    const head = applyIndexingPolicy(createRouteSeoHead('/tasks'), false);
    expect(head.title).toBeTruthy();
    expect(head.meta.some((tag) => 'name' in tag && tag.name === 'description')).toBe(true);
    expect(head.meta.some((tag) => 'property' in tag && tag.property === 'og:title')).toBe(true);
  });
  it('returns the upstream head unchanged when indexing is allowed', () => {
    const original = createRouteSeoHead('/tasks');
    expect(applyIndexingPolicy(original, true)).toBe(original);
    expect(JSON.stringify(original)).toContain('index, follow');
    expect(JSON.stringify(original)).toContain('rel":"canonical');
  });
  it('survives a head without link, meta or script', () => {
    expect(applyIndexingPolicy({}, false)).toEqual({ link: [], meta: [], script: [] });
  });
});
describe('robotsTxtAllowingIndexing', () => {
  it('lists upstream rules and the sitemap of the given origin, without a double slash', () => {
    const text = robotsTxtAllowingIndexing('https://example.test/');
    expect(text).toContain('Allow: /');
    expect(text).toContain('Disallow: /api/');
    expect(text).toContain('Sitemap: https://example.test/sitemap.xml');
  });
});
