// @vitest-environment happy-dom
import { mockNuxtImport } from '@nuxt/test-utils/runtime';
import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createI18n } from 'vue-i18n';
import de from '@/locales/de.json';
import deOverrides from '@/locales/de.overrides.json';
import en from '@/locales/en.json';
const runtimeConfig = vi.hoisted(() => ({
  public: { accountDeletionUrl: 'https://tarkov-stammtisch.de/profile/settings' },
}));
mockNuxtImport('useRuntimeConfig', () => () => runtimeConfig);
type Tree = Record<string, unknown>;
const merge = (base: Tree, over: Tree): Tree => {
  const out: Tree = { ...base };
  for (const [key, value] of Object.entries(over)) {
    const current = out[key];
    out[key] =
      value && typeof value === 'object' && current && typeof current === 'object'
        ? merge(current as Tree, value as Tree)
        : value;
  }
  return out;
};
const GenericCardStub = {
  props: ['title'],
  template: '<section><h2>{{ title }}</h2><slot name="content" /></section>',
};
const UButtonStub = {
  inheritAttrs: false,
  props: ['to'],
  template: '<a :href="to" v-bind="$attrs"><slot /></a>',
};
const mountNotice = async (locale: 'de' | 'en') => {
  const i18n = createI18n({
    legacy: false,
    locale,
    fallbackLocale: 'en',
    missingWarn: false,
    fallbackWarn: false,
    messages: { en, de: merge(de as Tree, deOverrides as Tree) as typeof en },
  } as never);
  const { default: Notice } =
    await import('@/features/settings/StammtischAccountDeletionNotice.vue');
  return mount(Notice, {
    global: {
      plugins: [i18n],
      stubs: { GenericCard: GenericCardStub, UButton: UButtonStub },
    },
  });
};
describe('StammtischAccountDeletionNotice', () => {
  beforeEach(() => {
    runtimeConfig.public.accountDeletionUrl = 'https://tarkov-stammtisch.de/profile/settings';
  });
  it('points to the main site and opens it safely in a new tab', async () => {
    const wrapper = await mountNotice('de');
    const link = wrapper.get('[data-testid="stammtisch-account-deletion-link"]');
    expect(link.attributes('href')).toBe('https://tarkov-stammtisch.de/profile/settings');
    expect(link.attributes('target')).toBe('_blank');
    expect(link.attributes('rel')).toBe('noopener noreferrer');
  });
  it('offers no in-tracker delete or confirmation control that could never succeed', async () => {
    const wrapper = await mountNotice('de');
    expect(wrapper.findAll('button')).toHaveLength(0);
    expect(wrapper.find('input').exists()).toBe(false);
  });
  it('follows the configured deletion URL', async () => {
    runtimeConfig.public.accountDeletionUrl = 'https://dev.tarkov-stammtisch.de/profile/settings';
    const wrapper = await mountNotice('de');
    expect(wrapper.get('a').attributes('href')).toBe(
      'https://dev.tarkov-stammtisch.de/profile/settings'
    );
  });
  it('renders German copy for the de locale, from the fork overrides', async () => {
    const wrapper = await mountNotice('de');
    expect(wrapper.text()).toContain('Konto löschen');
    expect(wrapper.text()).toContain('Tarkov-Stammtisch-Konto');
    expect(wrapper.text()).not.toContain('settings.fork_account_deletion');
  });
  it('renders English copy for the en locale', async () => {
    const wrapper = await mountNotice('en');
    expect(wrapper.text()).toContain('Delete account');
    expect(wrapper.text()).toContain('main site');
    expect(wrapper.text()).not.toContain('settings.fork_account_deletion');
  });
  it('keeps the German and English copy distinct', async () => {
    const german = (await mountNotice('de')).text();
    const english = (await mountNotice('en')).text();
    expect(german).not.toBe(english);
  });
});
