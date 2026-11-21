import { logger } from '@/utils/logger';
import { SupabaseCallbackPendingError } from '@/utils/supabaseReadiness';
import { hydrateUserFromSession, type HydratableUser } from '@/utils/userHydration';
type SupabaseGuardContext = {
  ready: () => Promise<unknown>;
  user: HydratableUser;
};
export async function ensureSupabaseReadyForRoute(
  supabase: SupabaseGuardContext | null | undefined,
  routeName: string
): Promise<'ready' | 'callback_pending' | 'failed'> {
  // The Supabase plugin is browser-only. Without this check a missing client would throw inside
  // the catch block below (reading `.user` of undefined) and hide the real condition.
  if (!supabase) {
    logger.error(`${routeName}: Supabase client unavailable`);
    return 'failed';
  }
  try {
    await supabase.ready();
    return 'ready';
  } catch (error) {
    if (error instanceof SupabaseCallbackPendingError) return 'callback_pending';
    hydrateUserFromSession(supabase.user, null);
    logger.error(`${routeName}: Supabase bootstrap failed`, error);
    return 'failed';
  }
}
export const handleSupabaseReadinessFailure = (readiness: 'callback_pending' | 'failed') =>
  readiness === 'callback_pending' ? abortNavigation() : navigateTo('/login');
