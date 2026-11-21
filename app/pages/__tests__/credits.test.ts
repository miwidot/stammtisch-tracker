// @vitest-environment happy-dom
import { mockNuxtImport } from '@nuxt/test-utils/runtime';
import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const { seoMeta, runtimeConfig } = vi.hoisted(() => ({
  seoMeta: vi.fn(),
  runtimeConfig: { public: { upstreamGithubEnabled: false as unknown } },
}));
mockNuxtImport('useSeoMeta', () => seoMeta);
mockNuxtImport('useRuntimeConfig', () => () => runtimeConfig);
vi.mock('@/features/credits/creditSections', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/credits/creditSections')>();
  return {
    ...actual,
    staticCreditSections: [
      {
        key: 'original_creator',
        members: [{ name: 'Thaddeus' }],
        fullWidth: true,
      },
      {
        key: 'beta_testers',
        members: [{ name: 'Adealia' }],
        fullWidth: false,
        compact: true,
      },
    ],
  };
});
vi.mock('vue-i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-i18n')>()),
  useI18n: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));
describe('credits page', () => {
  beforeEach(() => {
    runtimeConfig.public.upstreamGithubEnabled = false;
  });
  it('renders every static section with client-only contributors when upstream GitHub is enabled', async () => {
    runtimeConfig.public.upstreamGithubEnabled = true;
    const { default: CreditsPage } = await import('@/pages/credits.vue');
    const wrapper = mount(CreditsPage, {
      global: {
        stubs: {
          ClientOnly: { template: '<div><slot /></div>' },
          ContributorsList: { template: '<div data-testid="contributors" />' },
          CreditMemberList: {
            props: ['members'],
            template:
              '<ul><li v-for="member in members" :key="member.name">{{ member.name }}</li></ul>',
          },
          NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
          UContainer: { template: '<main><slot /></main>' },
          UIcon: { template: '<i />' },
        },
      },
    });
    const sections = wrapper.findAll('section');
    expect(sections).toHaveLength(2);
    expect(sections[0]?.classes()).toContain('md:col-span-2');
    expect(sections[1]?.classes()).not.toContain('md:col-span-2');
    expect(wrapper.find('[data-testid="contributors"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('page.credits.sections.original_creator');
    expect(seoMeta).not.toHaveBeenCalled();
  });
  it.each([false, undefined, null, 'true', 1])(
    'shows static upstream attribution and never mounts the contributor list (%j)',
    async (flag) => {
      runtimeConfig.public.upstreamGithubEnabled = flag;
      const { default: CreditsPage } = await import('@/pages/credits.vue');
      const wrapper = mount(CreditsPage, {
        global: {
          stubs: {
            ClientOnly: { template: '<div><slot /></div>' },
            ContributorsList: { template: '<div data-testid="contributors" />' },
            CreditMemberList: { template: '<ul />' },
            NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
            UContainer: { template: '<main><slot /></main>' },
            UIcon: { template: '<i />' },
          },
        },
      });
      expect(wrapper.find('[data-testid="contributors"]').exists()).toBe(false);
      const upstream = wrapper.get(
        'a[href="https://github.com/tarkovtracker-org/TarkovTracker/graphs/contributors"]'
      );
      expect(upstream.attributes('rel')).toBe('noopener noreferrer');
      expect(upstream.attributes('target')).toBe('_blank');
      expect(wrapper.text()).toContain('page.credits.contributors.upstream_note');
    }
  );
  it('links to the about page for the team directory', async () => {
    const { default: CreditsPage } = await import('@/pages/credits.vue');
    const wrapper = mount(CreditsPage, {
      global: {
        stubs: {
          ClientOnly: { template: '<div><slot /></div>' },
          ContributorsList: { template: '<div />' },
          CreditMemberList: { template: '<ul />' },
          NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
          UContainer: { template: '<main><slot /></main>' },
          UIcon: { template: '<i />' },
        },
      },
    });
    const aboutLink = wrapper.get('a[href="/about"]');
    expect(aboutLink.text()).toContain('page.credits.team_link');
  });
});
