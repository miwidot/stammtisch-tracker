import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it, vi } from 'vitest';
import { useNuxtApp } from '#imports';
import { RESOURCES, getResourceBySlug } from '@/features/resources/resourceData';
import ResourceGuidePage from '@/pages/resources/[slug].vue';
import ResourcesIndexPage from '@/pages/resources/index.vue';
import { CLIENT_DOCUMENT_ROUTES, PUBLIC_SEO_ROUTES } from '@/utils/routeSeo';
const routeState = vi.hoisted(() => ({ slug: '' }));
// The page reads its slug from the matched route; mounting the component directly has no match.
mockNuxtImport('useRoute', () => () => ({ params: { slug: routeState.slug }, path: '/resources' }));
// Fork: the TarkovMonitor card and guide are hidden (see FORK.md 3.13).
const GUIDE_PATH = '/resources/tarkovmonitor';
describe('hidden TarkovMonitor resource', () => {
  it('is absent from the resource data and every list derived from it', () => {
    expect(RESOURCES.some((resource) => resource.slug === 'tarkovmonitor')).toBe(false);
    expect(getResourceBySlug('tarkovmonitor')).toBeUndefined();
    expect(PUBLIC_SEO_ROUTES).not.toContain(GUIDE_PATH);
    expect(CLIENT_DOCUMENT_ROUTES).not.toContain(GUIDE_PATH);
  });
  it('keeps the other companion app so the group heading never renders empty', () => {
    expect(RESOURCES.some((resource) => resource.category === 'companion_apps')).toBe(true);
    expect(getResourceBySlug('ratscanner')?.hasGuide).toBe(true);
  });
  it.each(['en', 'de'] as const)(
    'does not list TarkovMonitor on /resources in %s',
    async (locale) => {
      const i18n = useNuxtApp().$i18n as { setLocale: (code: string) => Promise<void> };
      await i18n.setLocale(locale);
      const wrapper = await mountSuspended(ResourcesIndexPage, { route: '/resources' });
      expect(wrapper.text()).toContain('RatScanner');
      expect(wrapper.text().toLowerCase()).not.toContain('tarkovmonitor');
      expect(wrapper.html().toLowerCase()).not.toContain('/resources/tarkovmonitor');
      await i18n.setLocale('en');
    }
  );
  it('still renders a guide that exists, so the 404 below is specific to the hidden slug', async () => {
    routeState.slug = 'ratscanner';
    const wrapper = await mountSuspended(ResourceGuidePage, { route: '/resources/ratscanner' });
    expect(wrapper.text()).toContain('RatScanner');
  });
  it('answers the guide route with a 404 error instead of rendering the guide', async () => {
    routeState.slug = 'tarkovmonitor';
    const result = await mountSuspended(ResourceGuidePage, { route: GUIDE_PATH }).then(
      (wrapper) => wrapper.text(),
      (error: unknown) => error
    );
    expect(result).toMatchObject({ statusCode: 404 });
  });
});
