// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import PageHeader from '@/components/ui/PageHeader.vue';
import KappaSeoPage from '@/features/seo-pages/kappa.vue';
vi.mock('vue-i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}));
// The page body is covered by kappa.page.test.ts; here it only has to host the header slot.
vi.mock('@/pages/kappa.vue', () => ({
  default: { template: '<div data-testid="kappa-body"><slot name="header" /></div>' },
}));
describe('/kappa SEO wrapper', () => {
  it('renders the shared PageHeader with the Kappa title and subtitle', async () => {
    const wrapper = mount(KappaSeoPage);
    await wrapper.vm.$nextTick();
    const header = wrapper.getComponent(PageHeader);
    expect(header.props('title')).toBe('common.kappa_lightkeeper');
    expect(header.props('description')).toBe('page.kappa.subtitle');
    expect(wrapper.get('h1').text()).toBe('common.kappa_lightkeeper');
  });
});
