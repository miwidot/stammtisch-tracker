import { logger } from '@/utils/logger';
const HANDOFF_TOKEN_KEY = 'tracker_token';
function extractHandoffToken(hash: string): string | null {
  if (!hash) return null;
  const normalized = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!normalized) return null;
  const params = new URLSearchParams(normalized);
  const rawToken = params.get(HANDOFF_TOKEN_KEY);
  if (!rawToken) return null;
  try {
    const decoded = decodeURIComponent(rawToken).trim();
    return decoded.length > 0 ? decoded : null;
  } catch (error) {
    logger.warn('[TrackerHandoff] Failed to decode handoff token from URL fragment', error);
    return null;
  }
}
export default defineNuxtPlugin({
  name: 'tracker-handoff',
  dependsOn: ['supabase'],
  enforce: 'post',
  async setup(nuxtApp) {
    if (!import.meta.client) return;
    const rawHash = window.location.hash;
    if (!rawHash.includes(HANDOFF_TOKEN_KEY)) return;
    const token = extractHandoffToken(rawHash);
    // Nuxt's own router plugin re-applies the ORIGINAL initial route (fragment included) via its
    // `app:created` hook whenever nothing has updated `router.currentRoute.value` in the meantime.
    // A plain `history.replaceState` edits only the address bar, so that stomp always wins the
    // race. Clearing the fragment through the router (when available) keeps its internal state in
    // sync and survives that replay; the raw history edit stays as a synchronous fallback.
    const clearHandoffFragment = (): void => {
      const router = nuxtApp.$router;
      if (router?.currentRoute.value.hash) {
        const current = router.currentRoute.value;
        router.replace({ hash: '', path: current.path, query: current.query }).catch((error) => {
          logger.warn('[TrackerHandoff] Failed to clear handoff fragment via router', error);
        });
      }
      if (window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    };
    const cleanup = (): void => {
      clearHandoffFragment();
      // Registered after Nuxt's own `app:created` hookOnce (added during router plugin setup,
      // which always resolves before this post-enforce plugin runs), so it fires last and wins.
      if (typeof nuxtApp.hook === 'function') {
        nuxtApp.hook('app:created', clearHandoffFragment);
      }
    };
    if (!token) {
      cleanup();
      return;
    }
    try {
      await nuxtApp.$supabase.ready();
      const { error } = await nuxtApp.$supabase.client.auth.verifyOtp({
        token_hash: token,
        type: 'email',
      });
      if (error) {
        logger.warn('[TrackerHandoff] Handoff token verification failed', error.message);
      }
    } catch (error) {
      logger.warn('[TrackerHandoff] Failed to redeem handoff token', error);
    } finally {
      cleanup();
    }
  },
});
