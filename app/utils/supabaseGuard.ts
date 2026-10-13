import { logger } from '@/utils/logger';
import { hydrateUserFromSession, type HydratableUser } from '@/utils/userHydration';
type SupabaseGuardContext = {
  ready: () => Promise<unknown>;
  user: HydratableUser;
};
export async function ensureSupabaseReadyForRoute(
  supabase: SupabaseGuardContext | null | undefined,
  routeName: string
): Promise<boolean> {
  // The Supabase plugin is browser-only (app/plugins/supabase.client.ts): any caller that
  // runs server-side (or before the plugin mounts) sees `undefined` here. Without this
  // guard, the catch block below would itself throw on `supabase.user` for an undefined
  // `supabase`, masking the real "client unavailable" condition behind a confusing
  // "Cannot read properties of undefined (reading 'user')" TypeError.
  if (!supabase) {
    logger.error(`${routeName}: Supabase client unavailable`);
    return false;
  }
  try {
    await supabase.ready();
    return true;
  } catch (error) {
    hydrateUserFromSession(supabase.user, null);
    logger.error(`${routeName}: Supabase bootstrap failed`, error);
    return false;
  }
}
