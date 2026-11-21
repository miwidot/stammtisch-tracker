import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { useNuxtApp, useRouter, useRuntimeConfig } from '#imports';
import { useRouteSeo } from '@/composables/useRouteSeo';
/** Fork: noindex everywhere by default, also on routes upstream marks indexable. */
describe('route SEO head with indexing switched off (default)', () => {
  it.each(['/tasks', '/', '/about', '/resources'])(
    'renders noindex and no canonical, alternate or JSON-LD on the public route %s',
    async (path) => {
      expect(useRuntimeConfig().public.allowIndexing).toBe(false);
      // Fork: require-auth sends signed-out visitors to /login.
      const supabaseUser = useNuxtApp().$supabase.user as { loggedIn: boolean };
      supabaseUser.loggedIn = true;
      let router: ReturnType<typeof useRouter>;
      const wrapper = await mountSuspended(
        defineComponent({
          setup() {
            router = useRouter();
            useRouteSeo();
            return () => h('span');
          },
        }),
        { route: path }
      );
      try {
        await nextTick();
        await new Promise((resolve) => setTimeout(resolve, 100));
        expect(router!.currentRoute.value.path).toBe(path);
        const head = document.head;
        expect(head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
          'noindex, nofollow'
        );
        expect(head.querySelector('link[rel="canonical"]')).toBeNull();
        expect(head.querySelector('link[rel="alternate"]')).toBeNull();
        expect(head.querySelector('script[type="application/ld+json"]')).toBeNull();
      } finally {
        supabaseUser.loggedIn = false;
        wrapper.unmount();
      }
    }
  );
});
