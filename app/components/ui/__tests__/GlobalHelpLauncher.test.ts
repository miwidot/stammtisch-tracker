import { mountSuspended } from '@nuxt/test-utils/runtime';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useRuntimeConfig } from '#imports';
import GlobalHelpLauncher from '@/components/ui/GlobalHelpLauncher.vue';
const stubs = {
  UPopover: { template: '<div><slot /><slot name="content" /></div>' },
  UModal: true,
  AppTooltip: { template: '<span><slot /></span>' },
};
const mountLauncher = () => mountSuspended(GlobalHelpLauncher, { global: { stubs } });
const publicConfig = () => useRuntimeConfig().public as { discordInviteUrl: string };
describe('GlobalHelpLauncher report link (fork)', () => {
  let original = '';
  beforeEach(() => {
    original = publicConfig().discordInviteUrl;
  });
  afterEach(() => {
    publicConfig().discordInviteUrl = original;
  });
  it('sends "report a problem" to the Stammtisch Discord, opened safely in a new tab', async () => {
    const wrapper = await mountLauncher();
    const link = wrapper.get('a[href="https://discord.gg/tarkovstammtisch"]');
    expect(link.attributes('target')).toBe('_blank');
    expect(link.attributes('rel')).toBe('noopener noreferrer');
    expect(link.text()).toMatch(/discord/i);
  });
  it('has no link to upstream issues or repository in the help menu', async () => {
    const wrapper = await mountLauncher();
    const hrefs = wrapper.findAll('a').map((a) => a.attributes('href') ?? '');
    expect(hrefs.some((href) => href.includes('github.com/tarkovtracker-org'))).toBe(false);
    expect(hrefs.some((href) => href.includes('discord.gg/M8nBgA2sT6'))).toBe(false);
  });
  it('follows the configured invite and ignores an unusable one', async () => {
    publicConfig().discordInviteUrl = 'https://discord.gg/custom-invite';
    expect(
      (await mountLauncher()).find('a[href="https://discord.gg/custom-invite"]').exists()
    ).toBe(true);
    publicConfig().discordInviteUrl = 'javascript:alert(1)';
    const wrapper = await mountLauncher();
    expect(wrapper.find('a[href^="javascript:"]').exists()).toBe(false);
    expect(wrapper.find('a[href="https://discord.gg/tarkovstammtisch"]').exists()).toBe(true);
  });
});
