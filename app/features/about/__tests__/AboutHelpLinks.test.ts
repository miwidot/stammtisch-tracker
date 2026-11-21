// @vitest-environment happy-dom
import { mockNuxtImport } from '@nuxt/test-utils/runtime';
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
mockNuxtImport('useRuntimeConfig', () => () => ({
  public: { discordInviteUrl: 'https://discord.gg/tarkovstammtisch' },
}));
vi.mock('vue-i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-i18n')>()),
  useI18n: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));
describe('AboutHelpLinks', () => {
  it('links support resources externally with safe rels and credits internally', async () => {
    const { default: AboutHelpLinks } = await import('@/features/about/AboutHelpLinks.vue');
    const wrapper = mount(AboutHelpLinks, {
      global: {
        stubs: {
          NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
          UIcon: { template: '<i />' },
        },
      },
    });
    const discordLink = wrapper.get('a[href="https://discord.gg/tarkovstammtisch"]');
    expect(discordLink.attributes('target')).toBe('_blank');
    expect(discordLink.attributes('rel')).toBe('noopener noreferrer');
    // Fork: no upstream GitHub issues or security-policy link, help goes to our Discord.
    expect(wrapper.html()).not.toContain('github.com/tarkovtracker-org');
    expect(wrapper.html()).not.toContain('discord.gg/M8nBgA2sT6');
    expect(wrapper.findAll('a[href^="https://"]')).toHaveLength(1);
    expect(wrapper.get('a[href="/credits"]').text()).toContain('page.about.help.credits_link');
  });
});
