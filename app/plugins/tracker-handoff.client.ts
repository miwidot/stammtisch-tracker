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
function removeTokenFromUrl(): void {
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
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
    if (!token) {
      removeTokenFromUrl();
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
      removeTokenFromUrl();
    }
  },
});
