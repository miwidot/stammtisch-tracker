// @vitest-environment happy-dom
import { mockNuxtImport } from '@nuxt/test-utils/runtime';
import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { forkChangelogItems } from '@/server/utils/forkChangelog';
const state = vi.hoisted(() => ({ locale: 'de' as 'de' | 'en', urls: [] as string[] }));
mockNuxtImport('useFetch', () => (url: () => string) => {
  state.urls.push(url());
  return {
    data: ref({
      source: 'releases',
      hasMore: false,
      items: [
        ...forkChangelogItems(state.locale),
        { date: '2026-11-14', label: 'v1.90.0', bullets: ['Added floor guidance.', 'Fixed maps.'] },
      ],
    }),
    pending: ref(false),
    error: ref(null),
    refresh: vi.fn(),
  };
});
vi.mock('vue-i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-i18n')>()),
  useI18n: () => ({
    locale: ref(state.locale),
    t: (key: string) => key.replace('page.changelog.types.', 'badge:'),
  }),
}));
const mountPage = async () => {
  const { default: ChangelogPage } = await import('@/pages/changelog.vue');
  return mount(ChangelogPage, {
    global: {
      stubs: {
        UContainer: { template: '<main><slot /></main>' },
        UIcon: { template: '<i />' },
        UButton: { template: '<button><slot /></button>' },
        UBadge: {
          props: ['color'],
          template: '<span class="badge" :data-color="color"><slot /></span>',
        },
      },
    },
  });
};
describe('changelog page', () => {
  beforeEach(() => {
    state.urls = [];
    state.locale = 'de';
  });
  it('links to the upstream release notes as a plain external link', async () => {
    const wrapper = await mountPage();
    const link = wrapper.get(
      'a[href="https://github.com/tarkovtracker-org/TarkovTracker/releases"]'
    );
    expect(link.attributes('rel')).toBe('noopener noreferrer');
    expect(link.attributes('target')).toBe('_blank');
    expect(link.text()).toContain('page.changelog.upstream_link');
  });
  it('asks the API for the current UI language', async () => {
    await mountPage();
    expect(state.urls[0]).toBe('/api/changelog?limit=20&lang=de');
    state.locale = 'en';
    await mountPage();
    expect(state.urls[1]).toBe('/api/changelog?limit=20&lang=en');
  });
  it('shows German fork bullets with matching badges and without the leading verb', async () => {
    const wrapper = await mountPage();
    const text = wrapper.text();
    expect(text).toContain('Bitte Einstellungen prüfen');
    expect(text).toContain('Etagen-Hinweise, Extract-Voraussetzungen');
    expect(text).not.toContain('Hinzugefügt: Etagen-Hinweise');
    expect(text).toContain('badge:added');
    expect(text).toContain('badge:updated');
    expect(text).toContain('badge:improved');
    expect(text).toContain('badge:changed');
  });
  it('keeps the upstream English badges and colours', async () => {
    state.locale = 'en';
    const wrapper = await mountPage();
    const colors = wrapper.findAll('.badge').map((badge) => badge.attributes('data-color'));
    expect(colors).toContain('success');
    expect(colors).toContain('error');
    expect(colors).toContain('neutral');
    expect(wrapper.text()).toContain('floor guidance');
    expect(wrapper.text()).not.toContain('Added floor guidance');
  });
});
