import { ensureSupabaseReadyForRoute } from '@/utils/supabaseGuard';
const PUBLIC_ROUTE_PATHS = new Set(['/login', '/auth/callback', '/herkunft', '/credits', '/about']);
export default defineNuxtRouteMiddleware(async (to) => {
  // Server-side rendering only ever produces the generic, non-personalized public SEO
  // document for a route (routeRules in nuxt.config.ts restrict ssr:true to
  // PUBLIC_SEO_ROUTES; the real tracker UI only mounts client-side via <ClientOnly>, see
  // app/features/seo-pages/*.vue). The Supabase client is browser-only
  // (app/plugins/supabase.client.ts), so `useNuxtApp().$supabase` is undefined on the
  // server and this check would throw on every SSR/prerender request (1.85.0 merge:
  // upstream flipped these routes from ssr:false to ssr:true). Hydration re-runs this
  // middleware on the client and still enforces the redirect below.
  if (import.meta.server) return;
  if (PUBLIC_ROUTE_PATHS.has(to.path)) return;
  const { $supabase } = useNuxtApp();
  if (!(await ensureSupabaseReadyForRoute($supabase, 'Require-auth middleware'))) {
    return navigateTo('/login');
  }
  if (!$supabase.user.loggedIn) {
    return navigateTo('/login');
  }
});
