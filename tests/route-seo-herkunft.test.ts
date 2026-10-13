import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { useRouteSeo } from '@/composables/useRouteSeo';
import HerkunftPage from '@/pages/herkunft.vue';
// The real app wires both of these on top of each other on every route: app.vue calls
// useRouteSeo() once globally (the only page in the app with a page-level useSeoMeta call,
// see herkunft.vue). Mount the same combination here to prove the ACTUAL merged <head> output,
// instead of asserting either piece in isolation and hoping Unhead's dedupe resolves as expected.
describe('herkunft route SEO integration', () => {
  it('keeps the localized page title/description while inheriting indexable SEO from the registry', async () => {
    const wrapper = await mountSuspended(
      defineComponent({
        setup() {
          useRouteSeo();
          return () => h(HerkunftPage);
        },
      }),
      { route: '/herkunft' }
    );
    const settleHead = async () => {
      await nextTick();
      await new Promise((resolve) => setTimeout(resolve, 100));
    };
    try {
      await settleHead();
      // Page-level useSeoMeta (herkunft.vue) wins for the tags it sets: the visible/shared
      // title and description stay driven by page.herkunft.* (locale-aware at runtime via
      // t()), NOT the registry's separate English-only seo.routes.herkunft copy -- proving
      // Unhead resolves the later (child/page) registration over the earlier (root/app.vue)
      // one for a shared dedupe key, rather than the other way around.
      expect(document.title).toBe('Origin');
      expect(document.title).not.toBe('Fork Origin & License');
      expect(
        document.head.querySelector('meta[name="description"]')?.getAttribute('content')
      ).toContain('this fork comes from, what changed');
      // The registry (app/utils/routeSeo.ts PUBLIC_PAGE_KEYS) still owns everything the page
      // itself does not set: this is what makes /herkunft indexable, canonical, and sitemap/
      // prerender-eligible instead of falling back to the generic noindex "not_found" entry.
      expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
        'index, follow'
      );
      expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
        'https://tarkovtracker.org/herkunft'
      );
      expect(
        document.head.querySelector('meta[property="og:site_name"]')?.getAttribute('content')
      ).toBe('TarkovTracker');
      expect(document.head.querySelector('script[type="application/ld+json"]')).not.toBeNull();
    } finally {
      wrapper.unmount();
    }
  });
});
