// @vitest-environment happy-dom
// Fork decision (LIGHT_THEME_ENABLED = false in app/utils/forkConfig.ts): the theme selector is
// unreachable, so the theme row never renders inside AppPreferencesCard. This file mocks the real
// (disabled) flag value, overriding the global setup default (tests/fork-test-setup.ts) that lets
// AppPreferencesCard.test.ts keep exercising upstream's original enabled behavior unmodified.
import { mockNuxtImport } from '@nuxt/test-utils/runtime';
import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import AppPreferencesCard from '@/features/settings/AppPreferencesCard.vue';
import type { ThemeMode } from '@/utils/theme';
vi.mock('@/utils/forkConfig', () => ({
  LIGHT_THEME_ENABLED: false,
  STREAMER_MODE_PREFERENCE_ENABLED: false,
  ANTIFANDOM_PREFERENCE_ENABLED: false,
}));
const { mockState, setters } = vi.hoisted(() => ({
  mockState: {
    themeMode: 'dark' as ThemeMode,
  },
  setters: {
    setThemeMode: vi.fn(),
    setStreamerMode: vi.fn(),
    setWikiUseAntifandom: vi.fn(),
  },
}));
const loggedIn = ref(false);
mockNuxtImport('useNuxtApp', () => () => ({
  $supabase: {
    user: {
      get loggedIn() {
        return loggedIn.value;
      },
    },
  },
}));
vi.mock('@/stores/usePreferences', () => ({
  usePreferencesStore: () => ({
    getStreamerMode: false,
    getWikiUseAntifandom: true,
    setStreamerMode: setters.setStreamerMode,
    setWikiUseAntifandom: setters.setWikiUseAntifandom,
  }),
}));
vi.mock('@/composables/useTheme', () => ({
  useTheme: () => ({
    themeMode: mockState.themeMode,
    isLightTheme: mockState.themeMode === 'light',
    setThemeMode: setters.setThemeMode,
    toggleThemeMode: vi.fn(),
  }),
}));
vi.mock('vue-i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-i18n')>()),
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));
const pending = ref(false);
const status = ref('');
const selectLocale = vi.fn();
vi.mock('@/composables/useLocaleSwitch', () => ({
  useLocaleSwitch: () => ({
    locale: ref('en'),
    availableLocales: ['en', 'de'],
    pending,
    status,
    isDisabled: (code: string) => pending.value || (code === 'de' && status.value !== ''),
    selectLocale,
  }),
}));
const stubs = {
  GenericCard: {
    template: '<section><h2>{{ title }}</h2><slot name="content" /></section>',
    props: ['title', 'icon', 'iconColor', 'highlightColor', 'fillHeight', 'titleClasses'],
  },
  UIcon: { template: '<span />', props: ['name'] },
  USeparator: true,
  USwitch: {
    template: `<button type="button" role="switch" :aria-checked="modelValue" :disabled="disabled" @click="$emit('update:modelValue', !modelValue)" />`,
    props: ['modelValue', 'disabled'],
    emits: ['update:modelValue'],
  },
};
const mountCard = () =>
  mount(AppPreferencesCard, {
    global: {
      stubs,
      mocks: {
        $t: (key: string) => key,
      },
    },
  });
describe('AppPreferencesCard theme row disabled (fork: light theme unreachable)', () => {
  beforeEach(() => {
    mockState.themeMode = 'dark';
    vi.clearAllMocks();
    loggedIn.value = false;
    pending.value = false;
    status.value = '';
  });
  it('renders no theme selector, radio option or theme label', () => {
    const wrapper = mountCard();
    expect(wrapper.find('fieldset').exists()).toBe(false);
    expect(wrapper.find('input[type="radio"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('settings.appearance.theme');
    expect(wrapper.text()).not.toContain('settings.appearance.theme_light');
  });
  it('never calls setThemeMode, even after interacting with the card', async () => {
    const wrapper = mountCard();
    await wrapper.get('select').setValue('de');
    expect(setters.setThemeMode).not.toHaveBeenCalled();
  });
  it('keeps the language selector and renders no switches', () => {
    const wrapper = mountCard();
    expect(wrapper.find('select').exists()).toBe(true);
    expect(wrapper.findAll('[role="switch"]')).toHaveLength(0);
  });
  it('renders neither the streamer-mode nor the antifandom row, but keeps the Sprache row', () => {
    const wrapper = mountCard();
    expect(wrapper.text()).toContain('settings.locale');
    expect(wrapper.text()).not.toContain('settings.general.privacy_mode');
    expect(wrapper.text()).not.toContain('settings.interface.links.antifandom');
    expect(wrapper.find('#settings-privacy-mode-label').exists()).toBe(false);
    expect(wrapper.find('#settings-antifandom-label').exists()).toBe(false);
  });
  it('leaves no trailing separator or empty gap after the language row', () => {
    const wrapper = mountCard();
    const last = wrapper.get('.space-y-3').element.lastElementChild;
    expect(last?.querySelector('select')).not.toBeNull();
    expect(wrapper.findAllComponents({ name: 'USeparator' })).toHaveLength(0);
    expect(wrapper.html()).not.toContain('use-separator');
  });
  it('never writes the hidden preferences', async () => {
    const wrapper = mountCard();
    await wrapper.get('select').setValue('de');
    expect(setters.setStreamerMode).not.toHaveBeenCalled();
    expect(setters.setWikiUseAntifandom).not.toHaveBeenCalled();
  });
  it('starts with the language row instead of a dangling separator', () => {
    const wrapper = mountCard();
    const first = wrapper.get('.space-y-3').element.firstElementChild;
    expect(first?.querySelector('select')).not.toBeNull();
  });
});
