// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
const mountFooter = async () => {
  const { default: AppFooter } = await import('@/shell/AppFooter.vue');
  return mount(AppFooter, {
    global: {
      stubs: {
        UIcon: true,
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
});
