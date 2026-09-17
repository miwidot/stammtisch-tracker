// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { createI18n } from 'vue-i18n';
import de from '@/locales/de.json';
import deOverrides from '@/locales/de.overrides.json';
import en from '@/locales/en.json';
type MessageTree = Record<string, unknown>;
// AppFooter now renders one i18n-driven line (footer.attribution / footer.origin_link);
// nuxt.config.ts merges de.json + de.overrides.json for the "de" locale, so tests
// must merge them the same way to see what a real user actually sees.
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
const mountFooter = async (locale: 'de' | 'en' = 'de') => {
  const { default: AppFooter } = await import('@/shell/AppFooter.vue');
  return mount(AppFooter, {
    global: {
      plugins: [buildI18n(locale)],
      stubs: {
        UIcon: true,
        NuxtLink: NuxtLinkStub,
      },
    },
  });
};
describe('AppFooter', () => {
  it('renders the Tarkov Stammtisch brand and tagline', async () => {
    const wrapper = await mountFooter();
    expect(wrapper.text()).toContain('Tarkov Stammtisch');
    expect(wrapper.text()).toContain('Die deutsche Escape from Tarkov Community');
  });
  it('renders exactly three columns', async () => {
    const wrapper = await mountFooter();
    expect(wrapper.findAll('h3')).toHaveLength(2);
    expect(wrapper.text()).toContain('Quick Links');
    expect(wrapper.text()).toContain('Rechtliches');
  });
  it('links Quick Links to our external stammtisch domain', async () => {
    const wrapper = await mountFooter();
    const links = wrapper.findAll('a');
    const byLabel = (label: string) => links.find((link) => link.text() === label);
    expect(byLabel('Über uns')?.attributes('href')).toBe('https://tarkov-stammtisch.de/community');
    expect(byLabel('Konvoi System')?.attributes('href')).toBe(
      'https://tarkov-stammtisch.de/konvoi'
    );
    expect(byLabel('Streamer')?.attributes('href')).toBe('https://tarkov-stammtisch.de/streamers');
    expect(byLabel('Für Streamer')?.attributes('href')).toBe(
      'https://tarkov-stammtisch.de/for-streamers'
    );
    expect(byLabel('Spenden ❤️')?.attributes('href')).toBe('https://tarkov-stammtisch.de/spenden');
  });
  it('opens the Discord link in a new tab with a safe rel attribute', async () => {
    const wrapper = await mountFooter();
    const discordLink = wrapper.findAll('a').find((link) => link.text() === 'Discord Server');
    expect(discordLink?.attributes('href')).toBe('https://discord.gg/tarkovstammtisch');
    expect(discordLink?.attributes('target')).toBe('_blank');
    expect(discordLink?.attributes('rel')).toBe('noopener noreferrer');
  });
  it('does not open internal stammtisch links in a new tab', async () => {
    const wrapper = await mountFooter();
    const aboutLink = wrapper.findAll('a').find((link) => link.text() === 'Über uns');
    expect(aboutLink?.attributes('target')).toBeUndefined();
    expect(aboutLink?.attributes('rel')).toBeUndefined();
  });
  it('links the Rechtliches column to our legal pages', async () => {
    const wrapper = await mountFooter();
    const links = wrapper.findAll('a');
    const byLabel = (label: string) => links.find((link) => link.text() === label);
    expect(byLabel('Discord Regeln')?.attributes('href')).toBe(
      'https://tarkov-stammtisch.de/regeln'
    );
    expect(byLabel('Impressum')?.attributes('href')).toBe('https://tarkov-stammtisch.de/impressum');
    expect(byLabel('Datenschutzerklärung')?.attributes('href')).toBe(
      'https://tarkov-stammtisch.de/datenschutz'
    );
    expect(byLabel('Nutzungsbedingungen')?.attributes('href')).toBe(
      'https://tarkov-stammtisch.de/nutzungsbedingungen'
    );
    expect(byLabel('Danke ❤️')?.attributes('href')).toBe('https://tarkov-stammtisch.de/danke');
  });
  it('renders the current year and the trademark disclaimer', async () => {
    const wrapper = await mountFooter();
    const currentYear = new Date().getFullYear().toString();
    expect(wrapper.text()).toContain(`© ${currentYear} Tarkov Stammtisch`);
    expect(wrapper.text()).toContain('Battlestate Games Limited');
  });
  it('adds an internal /herkunft link to Quick Links without target or rel', async () => {
    const wrapper = await mountFooter('de');
    const originLink = wrapper.findAll('a').find((link) => link.attributes('href') === '/herkunft');
    expect(originLink).toBeDefined();
    expect(originLink?.text()).toBe('Herkunft');
    expect(originLink?.attributes('target')).toBeUndefined();
    expect(originLink?.attributes('rel')).toBeUndefined();
  });
  it('renders the origin/license/source attribution line with three safe external links', async () => {
    const wrapper = await mountFooter('de');
    const links = wrapper.findAll('a');
    const trackerLink = links.find(
      (link) => link.attributes('href') === 'https://github.com/tarkovtracker-org/TarkovTracker'
    );
    const licenseLink = links.find(
      (link) => link.attributes('href') === 'https://www.gnu.org/licenses/gpl-3.0.html'
    );
    const sourceLink = links.find(
      (link) => link.attributes('href') === 'https://github.com/miwidot/stammtisch-tracker'
    );
    for (const link of [trackerLink, licenseLink, sourceLink]) {
      expect(link).toBeDefined();
      expect(link?.attributes('target')).toBe('_blank');
      expect(link?.attributes('rel')).toBe('noopener noreferrer');
    }
    expect(trackerLink?.text()).toBe('TarkovTracker');
    expect(licenseLink?.text()).toBe('GPLv3');
    expect(sourceLink?.text()).toBe('Quelltext');
    expect(wrapper.text()).toContain('Basiert auf');
  });
  it('renders the attribution line and origin link in English for the en locale', async () => {
    const wrapper = await mountFooter('en');
    expect(wrapper.text()).toContain('Based on');
    const links = wrapper.findAll('a');
    const sourceLink = links.find(
      (link) => link.attributes('href') === 'https://github.com/miwidot/stammtisch-tracker'
    );
    expect(sourceLink?.text()).toBe('Source code');
    const originLink = wrapper.findAll('a').find((link) => link.attributes('href') === '/herkunft');
    expect(originLink?.text()).toBe('Origin');
  });
  it('never renders the raw translation key when locale content is missing', async () => {
    const wrapper = await mountFooter('de');
    expect(wrapper.text()).not.toContain('footer.attribution');
    expect(wrapper.text()).not.toContain('footer.origin_link');
  });
});
