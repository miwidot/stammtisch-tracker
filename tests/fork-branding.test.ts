// Fork: the instance is "Tarkov Stammtisch", never upstream's "TarkovTracker.org".
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyIndexingPolicy } from '@/utils/indexingPolicy';
import {
  CLIENT_DOCUMENT_ROUTES,
  PUBLIC_SEO_ROUTES,
  createRouteSeoHead,
  resolveRouteSeo,
} from '@/utils/routeSeo';
import { SITE_NAME, SITE_TITLE_SUFFIX } from '@/utils/siteBrand';
// Case-sensitive on purpose: the display name, not the lowercase upstream domain that
// canonical links use (those only exist when indexing is switched on, see FORK.md 3.10).
const UPSTREAM_NAME = /TarkovTracker\.org/;
// Raw JSON: the Vitest module graph compiles imported locale files into message ASTs.
const readLocale = (file: string) =>
  JSON.parse(readFileSync(`app/locales/${file}`, 'utf-8')) as {
    seo: { site_name: string; routes: Record<string, { title: string }> };
    navigation_drawer: { brand_name: string };
  };
const english = readLocale('en.json');
const german = readLocale('de.json');
// Upstream-authored guide/credit pages that describe the upstream project by name on purpose
// (and /supporter, which answers 404 in this fork).
const ABOUT_UPSTREAM_ROUTES = new Set(['/supporter', '/resources/tarkovtracker_org_vs_io']);
const brandedRoutes = [...PUBLIC_SEO_ROUTES, ...CLIENT_DOCUMENT_ROUTES].filter(
  (path) => !ABOUT_UPSTREAM_ROUTES.has(path)
);
const readManifest = (file: string) =>
  JSON.parse(readFileSync(`public/${file}`, 'utf-8')) as {
    name: string;
    short_name: string;
  };
describe('fork branding: page titles', () => {
  it('names the instance Tarkov Stammtisch', () => {
    expect(SITE_NAME).toBe('Tarkov Stammtisch');
    expect(english.seo.site_name).toBe(SITE_NAME);
    expect(german.seo.site_name).toBe(SITE_NAME);
  });
  it.each(['/storyline', '/tasks', '/kappa'])('%s title ends with our name', (path) => {
    expect(resolveRouteSeo(path).title.endsWith(SITE_TITLE_SUFFIX)).toBe(true);
    expect(createRouteSeoHead(path).title.endsWith(SITE_TITLE_SUFFIX)).toBe(true);
  });
  it.each([
    ['en', english],
    ['de', german],
  ] as const)('%s locale titles for storyline, tasks and kappa end with our name', (_l, locale) => {
    for (const key of ['storyline', 'tasks', 'kappa'] as const)
      expect(locale.seo.routes[key].title.endsWith(SITE_TITLE_SUFFIX)).toBe(true);
  });
  it.each([
    ['en', english],
    ['de', german],
  ] as const)(
    '%s locale seo titles carry no upstream name outside upstream guides',
    (_l, locale) => {
      const offenders = Object.entries(locale.seo.routes)
        .filter(([key]) => !['supporter', 'tarkovtracker_org_vs_io'].includes(key))
        .filter(([, route]) => UPSTREAM_NAME.test(route.title));
      expect(offenders).toEqual([]);
      expect(UPSTREAM_NAME.test(locale.navigation_drawer.brand_name)).toBe(false);
    }
  );
  it('keeps the social title free of a repeated brand and uses our site name', () => {
    const head = createRouteSeoHead('/storyline');
    expect(head.meta).toContainEqual(
      expect.objectContaining({ property: 'og:title', content: 'Tarkov Storyline Tracker' })
    );
    expect(head.meta).toContainEqual(
      expect.objectContaining({ property: 'og:site_name', content: SITE_NAME })
    );
  });
  it.each([true, false])(
    'rendered head of every route has no upstream name (indexing %s)',
    (allowIndexing) => {
      for (const path of brandedRoutes) {
        const head = applyIndexingPolicy(createRouteSeoHead(path), allowIndexing);
        expect(JSON.stringify(head), path).not.toMatch(UPSTREAM_NAME);
      }
    }
  );
  it('names our site as publisher in the structured data', () => {
    const script = createRouteSeoHead('/').script[0]!;
    const graph = JSON.parse(script.innerHTML)['@graph'] as { name?: string }[];
    expect(graph.filter((node) => node.name).every((node) => node.name === SITE_NAME)).toBe(true);
  });
});
describe('fork branding: manifests and static head', () => {
  it.each(['manifest.json', 'manifest.webmanifest'])('%s names the instance', (file) => {
    const manifest = readManifest(file);
    expect(manifest.name).toBe(SITE_NAME);
    expect(manifest.short_name).not.toMatch(/TarkovTracker/i);
  });
  it('builds the static title template and site name from the shared constant', () => {
    const source = readFileSync('nuxt.config.ts', 'utf-8');
    expect(source).toContain('titleTemplate: `%s | ${SITE_NAME}`');
    expect(source).toContain("property: 'og:site_name', content: SITE_NAME");
  });
});
