/**
 * One-time `state` nonce for the Stammtisch login handoff (login CSRF protection).
 *
 * The login page stores a random nonce in this tab's sessionStorage and sends it to the main
 * site as `?state=`. The main site echoes it back in the URL fragment as `tracker_state`. The
 * handoff plugin redeems a `tracker_token` only when that value matches, once. A link crafted
 * by someone else cannot carry the nonce of the victim's tab, so it cannot sign them in as
 * the attacker's account.
 */
export const HANDOFF_STATE_STORAGE_KEY = 'tt_tracker_handoff_state';
export const HANDOFF_STATE_QUERY_PARAM = 'state';
export const HANDOFF_STATE_FRAGMENT_KEY = 'tracker_state';
const NONCE_BYTES = 32;
const toBase64Url = (bytes: Uint8Array): string => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
/** 256 random bits from the platform CSPRNG, URL-safe. */
export const createHandoffState = (): string =>
  toBase64Url(crypto.getRandomValues(new Uint8Array(NONCE_BYTES)));
/**
 * Stores a fresh nonce for this tab and returns the handoff URL carrying it.
 * Throws when sessionStorage is unavailable: without it the login could never complete.
 */
export const beginHandoff = (handoffUrl: string, origin: string): string => {
  const state = createHandoffState();
  window.sessionStorage.setItem(HANDOFF_STATE_STORAGE_KEY, state);
  const url = new URL(handoffUrl, origin);
  url.searchParams.set(HANDOFF_STATE_QUERY_PARAM, state);
  return url.toString();
};
/** Reads and removes the stored nonce, so it can never be used twice. */
export const consumeHandoffState = (): string | null => {
  try {
    const stored = window.sessionStorage.getItem(HANDOFF_STATE_STORAGE_KEY);
    window.sessionStorage.removeItem(HANDOFF_STATE_STORAGE_KEY);
    return stored && stored.length > 0 ? stored : null;
  } catch {
    return null;
  }
};
/** Length-independent comparison of two nonces. */
export const handoffStatesMatch = (expected: string | null, provided: string | null): boolean => {
  if (!expected || !provided) return false;
  let diff = expected.length ^ provided.length;
  const length = Math.max(expected.length, provided.length);
  for (let i = 0; i < length; i += 1) {
    diff |= (expected.charCodeAt(i) || 0) ^ (provided.charCodeAt(i) || 0);
  }
  return diff === 0;
};
