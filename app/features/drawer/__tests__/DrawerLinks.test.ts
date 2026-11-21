// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import DrawerLinks from '@/features/drawer/DrawerLinks.vue';
vi.mock('vue-i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}));
const mountLinks = (isCollapsed = false) =>
  mount(DrawerLinks, {
    props: { isCollapsed },
    global: {
      stubs: {
        DrawerItem: {
          props: ['to', 'localeKey'],
          template: '<li data-testid="drawer-item" :data-to="to" :data-key="localeKey" />',
        },
      },
    },
  });
const targets = (wrapper: ReturnType<typeof mountLinks>) =>
  wrapper.findAll('[data-testid="drawer-item"]').map((item) => item.attributes('data-to'));
describe('DrawerLinks (fork)', () => {
  it('has no Resources entry, the page is not part of this instance navigation', () => {
    expect(targets(mountLinks())).not.toContain('/resources');
    expect(mountLinks().html()).not.toContain('navigation_drawer.resources');
  });
  it('lists Settings exactly once, so the sidebar has no second More block with it', () => {
    expect(targets(mountLinks()).filter((to) => to === '/settings')).toHaveLength(1);
  });
  it('keeps the core navigation, collapsed or not', () => {
    for (const collapsed of [false, true]) {
      expect(targets(mountLinks(collapsed))).toEqual(
        expect.arrayContaining(['/', '/storyline', '/tasks', '/needed-items', '/hideout', '/team'])
      );
    }
  });
});
