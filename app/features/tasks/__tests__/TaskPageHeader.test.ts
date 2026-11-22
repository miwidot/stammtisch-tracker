// @vitest-environment happy-dom
import { mockNuxtImport } from '@nuxt/test-utils/runtime';
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { createI18n } from 'vue-i18n';
import TaskPageHeader from '@/features/tasks/TaskPageHeader.vue';
import de from '@/locales/de.json';
import deOverrides from '@/locales/de.overrides.json';
import en from '@/locales/en.json';
const routeState = { path: '/tasks' };
mockNuxtImport('useRoute', () => () => routeState);
const i18nFor = (locale: 'de' | 'en') =>
  createI18n({
    legacy: false,
    locale,
    fallbackLocale: 'en',
    messages: { en, de: { ...de, ...deOverrides } } as never,
  });
let activeLocale: 'de' | 'en' = 'de';
vi.mock('vue-i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-i18n')>()),
  useI18n: () => i18nFor(activeLocale).global,
}));
const mountHeader = (locale: 'de' | 'en', path = '/tasks') => {
  activeLocale = locale;
  routeState.path = path;
  const i18n = i18nFor(locale);
  return {
    i18n: { t: (key: string) => (i18n.global as unknown as { t: (k: string) => string }).t(key) },
    wrapper: mount(TaskPageHeader, {
      global: {
        plugins: [i18n],
        stubs: {
          TaskViewTabs: true,
          NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
        },
      },
    }),
  };
};
describe('TaskPageHeader', () => {
  it.each(['de', 'en'] as const)('hides the TarkovMonitor guide link in %s', (locale) => {
    const { wrapper, i18n } = mountHeader(locale);
    const description = i18n.t('seo.routes.tasks.description');
    expect(description).not.toBe('seo.routes.tasks.description');
    expect(wrapper.text()).toContain(description);
    expect(wrapper.text()).not.toContain('TarkovMonitor');
    expect(wrapper.find('a[href="/resources/tarkovmonitor"]').exists()).toBe(false);
    expect(wrapper.find('a').exists()).toBe(false);
    expect(wrapper.get('p').text()).toBe(description);
  });
  it.each(['/tasks/traders', '/tasks/maps', '/tasks/graph'])('has no guide link on %s', (path) => {
    const { wrapper } = mountHeader('en', path);
    expect(wrapper.text()).not.toContain('TarkovMonitor');
  });
});
