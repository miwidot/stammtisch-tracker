import { logger } from '@/utils/logger';
import {
  consumeHandoffState,
  HANDOFF_STATE_FRAGMENT_KEY,
  handoffStatesMatch,
} from '@/utils/trackerHandoffState';
const HANDOFF_TOKEN_KEY = 'tracker_token';
function readFragmentParam(hash: string, key: string): string | null {
  if (!hash) return null;
  const normalized = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!normalized) return null;
  const raw = new URLSearchParams(normalized).get(key);
  if (!raw) return null;
  try {
    const decoded = decodeURIComponent(raw).trim();
    return decoded.length > 0 ? decoded : null;
  } catch (error) {
    logger.warn(`[TrackerHandoff] Failed to decode ${key} from URL fragment`, error);
    return null;
  }
}
/**
 * Redeems the one-time login token the Stammtisch main site puts in the URL fragment.
 *
 * Login CSRF protection: the token is redeemed only when the fragment echoes the one-time
 * `state` nonce the login page stored in this tab (see trackerHandoffState.ts). A missing or
 * wrong state, or no nonce in this tab, means the link was not started here: nothing is
 * redeemed, the fragment is cleared and the user is sent to /login.
 *
 * An existing session is never replaced. If someone is already signed in, the current session
 * is kept and the token is dropped. The user must sign out first to switch accounts. A silent
 * switch is what login CSRF exploits, and asking would need UI before the app has mounted;
 * refusing costs a legitimate user one extra click.
 */
export default defineNuxtPlugin({
  name: 'tracker-handoff',
  dependsOn: ['supabase'],
  enforce: 'post',
  async setup(nuxtApp) {
    if (!import.meta.client) return;
    const rawHash = window.location.hash;
    if (!rawHash.includes(HANDOFF_TOKEN_KEY)) return;
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
    const goToLogin = (): void => {
      const router = nuxtApp.$router;
      if (!router) return;
      const replace = () =>
        router.replace({ path: '/login', query: {}, hash: '' }).catch((error: unknown) => {
          logger.warn('[TrackerHandoff] Failed to open /login', error);
        });
      void replace();
      if (typeof nuxtApp.hook === 'function') {
        nuxtApp.hook('app:created', () => void replace());
      }
    };
    const logRefusal = (reason: string): void => {
      logger.warn(`[TrackerHandoff] Handoff token not redeemed: ${reason}`);
    };
    const token = readFragmentParam(rawHash, HANDOFF_TOKEN_KEY);
    const providedState = readFragmentParam(rawHash, HANDOFF_STATE_FRAGMENT_KEY);
    // Consumed first and unconditionally: a nonce serves at most one returning navigation,
    // whatever the outcome.
    const expectedState = consumeHandoffState();
    if (!token) {
      cleanup();
      return;
    }
    if (!handoffStatesMatch(expectedState, providedState)) {
      logRefusal(
        providedState === null
          ? 'missing state'
          : expectedState === null
            ? 'no pending login in this tab'
            : 'state mismatch'
      );
      cleanup();
      goToLogin();
      return;
    }
    try {
      await nuxtApp.$supabase.ready();
      const existing = await nuxtApp.$supabase.client.auth.getSession().catch(() => null);
      if (existing?.data?.session?.user) {
        logRefusal('a session already exists, keeping it');
        return;
      }
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
