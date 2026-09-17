import { ensureSupabaseReadyForRoute } from '@/utils/supabaseGuard';
const PUBLIC_ROUTE_PATHS = new Set(['/login', '/auth/callback', '/herkunft', '/credits', '/about']);
export default defineNuxtRouteMiddleware(async (to) => {
  if (PUBLIC_ROUTE_PATHS.has(to.path)) return;
  const { $supabase } = useNuxtApp();
  if (!(await ensureSupabaseReadyForRoute($supabase, 'Require-auth middleware'))) {
    return navigateTo('/login');
  }
  if (!$supabase.user.loggedIn) {
    return navigateTo('/login');
  }
});
