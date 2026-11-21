import { ensureSupabaseReadyForRoute, handleSupabaseReadinessFailure } from '@/utils/supabaseGuard';
// Fork: every route needs a Stammtisch login except these. /auth/callback must stay open or a
// pending OAuth callback would redirect-loop; /herkunft, /credits and /about carry the licence
// attribution and must be readable before signing in.
const PUBLIC_ROUTE_PATHS = new Set(['/login', '/auth/callback', '/herkunft', '/credits', '/about']);
export default defineNuxtRouteMiddleware(async (to) => {
  if (PUBLIC_ROUTE_PATHS.has(to.path)) return;
  const { $supabase } = useNuxtApp();
  // The guard answers 'ready' | 'callback_pending' | 'failed'. Every non-ready answer is a truthy
  // string, so it must be compared explicitly: `!(await ...)` would treat 'failed' as success.
  const readiness = await ensureSupabaseReadyForRoute($supabase, 'Require-auth middleware');
  if (readiness !== 'ready') {
    return handleSupabaseReadinessFailure(readiness);
  }
  if (!$supabase.user.loggedIn) {
    return navigateTo('/login');
  }
});
