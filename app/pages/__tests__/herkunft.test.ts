import { mockNuxtImport } from '@nuxt/test-utils/runtime';
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { createI18n } from 'vue-i18n';
import de from '@/locales/de.json';
import deOverrides from '@/locales/de.overrides.json';
import en from '@/locales/en.json';
const { seoMeta } = vi.hoisted(() => ({ seoMeta: vi.fn() }));
mockNuxtImport('useSeoMeta', () => seoMeta);
type MessageTree = Record<string, unknown>;
// The i18n module registers de.json AND de.overrides.json for the "de" locale
// (nuxt.config.ts: files: ['de.json', 'de.overrides.json']); the overrides
// shadow/extend the base file the same way at runtime, so tests must merge
// them the same way to see what a real user actually sees.
function deepMerge(base: MessageTree, override: MessageTree): MessageTree {
  const merged: MessageTree = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const baseValue = merged[key];
    merged[key] =
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      baseValue !== null &&
      typeof baseValue === 'object' &&
      !Array.isArray(baseValue)
        ? deepMerge(baseValue as MessageTree, value as MessageTree)
        : value;
  }
  return merged;
}
const deMessages = deepMerge(de as MessageTree, deOverrides as MessageTree) as typeof en;
const buildI18n = (locale: 'de' | 'en') =>
  createI18n({
    legacy: false,
    locale,
    fallbackLocale: 'en',
    missingWarn: false,
    fallbackWarn: false,
    messages: {
      en,
      de: deMessages,
    },
  });
const NuxtLinkStub = { props: ['to'], template: '<a :href="to"><slot /></a>' };
const UContainerStub = { template: '<main><slot /></main>' };
const mountHerkunft = async (locale: 'de' | 'en' = 'de') => {
  const { default: HerkunftPage } = await import('@/pages/herkunft.vue');
  return mount(HerkunftPage, {
    global: {
      plugins: [buildI18n(locale)],
      stubs: {
        NuxtLink: NuxtLinkStub,
        UContainer: UContainerStub,
      },
    },
  });
};
describe('herkunft page', () => {
  it('renders the origin, changes, and related-projects sections', async () => {
    const wrapper = await mountHerkunft('de');
    expect(wrapper.get('h1').text()).toBe('Herkunft');
    const headings = wrapper.findAll('h2').map((h) => h.text());
    expect(headings).toEqual(['Herkunft', 'Unsere Änderungen', 'Verwandte Projekte']);
  });
  it('contains no PR references back to the upstream project', async () => {
    const wrapper = await mountHerkunft('de');
    const hrefs = wrapper.findAll('a').map((link) => link.attributes('href') ?? '');
    expect(hrefs.some((href) => /\/pull\/\d+/.test(href))).toBe(false);
    expect(wrapper.text()).not.toMatch(/PR #\d+/);
  });
  it('gives every external link a safe rel and target, and keeps internal links plain', async () => {
    const wrapper = await mountHerkunft('de');
    const links = wrapper.findAll('a');
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      const href = link.attributes('href') ?? '';
      if (href.startsWith('http')) {
        expect(link.attributes('target'), `expected target for ${href}`).toBe('_blank');
        expect(link.attributes('rel'), `expected rel for ${href}`).toBe('noopener noreferrer');
      } else {
        expect(link.attributes('target')).toBeUndefined();
        expect(link.attributes('rel')).toBeUndefined();
      }
    }
    const creditsLink = links.find((link) => link.attributes('href') === '/credits');
    expect(creditsLink).toBeDefined();
  });
  it('links to the exact upstream repo, GPLv3 text, LICENSE.md, and our fork', async () => {
    const wrapper = await mountHerkunft('de');
    const hrefs = wrapper.findAll('a').map((link) => link.attributes('href'));
    expect(hrefs).toContain('https://github.com/tarkovtracker-org/TarkovTracker');
    expect(hrefs).toContain('https://www.gnu.org/licenses/gpl-3.0.html');
    expect(hrefs).toContain(
      'https://github.com/tarkovtracker-org/TarkovTracker/blob/main/LICENSE.md'
    );
    expect(hrefs).toContain('https://github.com/miwidot/stammtisch-tracker');
  });
  it('renders real, distinct German copy — not a passed-through translation key', async () => {
    const wrapper = await mountHerkunft('de');
    const text = wrapper.text();
    expect(text).not.toContain('page.herkunft');
    expect(text).toContain('Diese Seite ist eine geänderte Fassung von');
    expect(text).toContain('Betrieben und angepasst vom Tarkov Stammtisch');
    expect(text).toContain('Deutsche Übersetzung und Lokalisierung');
  });
  it('renders real, distinct English copy — not a passed-through translation key', async () => {
    const wrapper = await mountHerkunft('en');
    const text = wrapper.text();
    expect(text).not.toContain('page.herkunft');
    expect(text).toContain('This site is a modified version of');
    expect(text).toContain('Operated and adapted by Tarkov Stammtisch');
    expect(text).toContain('German translation and localization');
    // The two locales must actually differ, not just both fall back to English.
    const deWrapper = await mountHerkunft('de');
    expect(deWrapper.text()).not.toBe(text);
  });
  it('configures localized SEO metadata', async () => {
    await mountHerkunft('de');
    expect(seoMeta).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.any(Object), description: expect.any(Object) })
    );
    const metadata = seoMeta.mock.calls[0]?.[0];
    expect(metadata.title.value).toBe('Herkunft');
    expect(metadata.description.value).toContain('Woher dieser Fork kommt');
  });
  it('falls back to the English label when a related-project translation is missing', async () => {
    // Simulate an incomplete German override: drop one related-project label
    // before building the i18n instance, then confirm the UI still works.
    const incompleteDe = deepMerge(de as MessageTree, deOverrides as MessageTree);
    delete (((incompleteDe.page as MessageTree).herkunft as MessageTree).related as MessageTree)
      .ratscanner;
    const i18n = createI18n({
      legacy: false,
      locale: 'de',
      fallbackLocale: 'en',
      missingWarn: false,
      fallbackWarn: false,
      messages: {
        en,
        de: incompleteDe as typeof en,
      },
    });
    const { default: HerkunftPage } = await import('@/pages/herkunft.vue');
    const wrapper = mount(HerkunftPage, {
      global: {
        plugins: [i18n],
        stubs: { NuxtLink: NuxtLinkStub, UContainer: UContainerStub },
      },
    });
    const ratScannerLink = wrapper
      .findAll('a')
      .find((link) => link.attributes('href') === 'https://github.com/RatScanner/RatScanner');
    expect(ratScannerLink).toBeDefined();
    // No German translation left for this key: vue-i18n falls back to the
    // English source instead of rendering the raw key path.
    expect(ratScannerLink?.text()).toContain('RatScanner');
    expect(ratScannerLink?.text()).not.toContain('page.herkunft.related.ratscanner');
  });
});
