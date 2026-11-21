// @vitest-environment happy-dom
import { mockNuxtImport } from '@nuxt/test-utils/runtime';
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import NavDrawer from '@/shell/NavDrawer.vue';
mockNuxtImport('useSharedBreakpoints', () => () => ({ belowMd: ref(false) }));
vi.mock('@/stores/useApp', () => ({
  useAppStore: () => ({
    mobileDrawerExpanded: false,
    drawerRail: false,
    setMobileDrawerExpanded: vi.fn(),
  }),
}));
vi.mock('@/stores/useTarkov', () => ({
  useTarkovStore: () => ({ getCurrentGameMode: () => 'pvp' }),
}));
vi.mock('vue-i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}));
const mountDrawer = () =>
  mount(NavDrawer, {
    global: {
      stubs: {
        DrawerGameSettings: true,
        DrawerLevel: true,
        DrawerLinks: { template: '<div data-testid="drawer-links" />' },
        NuxtImg: { props: ['src', 'alt'], template: '<img :src="src" :alt="alt" />' },
        NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
        UIcon: true,
        Transition: false,
      },
    },
  });
describe('NavDrawer (fork)', () => {
  it('shows the Stammtisch logo and brand name, not the upstream logo', () => {
    const wrapper = mountDrawer();
    const logo = wrapper.get('img');
    expect(logo.attributes('src')).toBe('/img/logos/stammtisch-logo.png');
    expect(logo.attributes('alt')).toBe('navigation_drawer.brand_name');
    expect(wrapper.html()).not.toContain('tarkovtrackerlogo');
  });
  it('has no extra "More" block under the links, Settings lives in DrawerLinks only', () => {
    const wrapper = mountDrawer();
    expect(wrapper.text()).not.toContain('common.more');
    expect(wrapper.find('a[href="/settings"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="drawer-links"]').exists()).toBe(true);
  });
});
