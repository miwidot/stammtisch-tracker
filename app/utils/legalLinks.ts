/**
 * Fork: upstream's /privacy and /terms-of-service name upstream's operator and contact. On this
 * instance the data controller is the Tarkov Stammtisch, so both routes redirect to the legal
 * pages of the main site and every internal link points there directly.
 *
 * The targets come ONLY from runtime config (NUXT_PUBLIC_LEGAL_PRIVACY_URL /
 * NUXT_PUBLIC_LEGAL_TERMS_URL), never from request input, so the redirect cannot be abused as an
 * open redirect. Attribution and licence pages stay with upstream.
 */
export const DEFAULT_LEGAL_PRIVACY_URL = 'https://tarkov-stammtisch.de/datenschutz';
export const DEFAULT_LEGAL_TERMS_URL = 'https://tarkov-stammtisch.de/nutzungsbedingungen';
export type LegalRoute = 'privacy' | 'terms';
/** Accepts only https URLs without embedded credentials; anything else falls back to the default. */
export const resolveLegalUrl = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') return fallback;
  try {
    const url = new URL(value.trim());
    if (url.protocol === 'https:' && !url.username && !url.password) return url.toString();
  } catch {
    // Not a URL: use the default.
  }
  return fallback;
};
export const resolveLegalLinks = (config: {
  legalPrivacyUrl?: unknown;
  legalTermsUrl?: unknown;
}): { privacyUrl: string; termsUrl: string } => ({
  privacyUrl: resolveLegalUrl(config.legalPrivacyUrl, DEFAULT_LEGAL_PRIVACY_URL),
  termsUrl: resolveLegalUrl(config.legalTermsUrl, DEFAULT_LEGAL_TERMS_URL),
});
/**
 * Which upstream legal route a path is. Tolerates casing (the client router is case-insensitive)
 * and trailing slashes; query and hash are not part of a pathname. Returns null for everything
 * else, including look-alikes such as `/privacy-policy` or `/privacy/x`.
 */
export const matchLegalRoute = (pathname: string): LegalRoute | null => {
  const normalized = pathname.toLowerCase().replace(/\/+$/, '');
  if (normalized === '/privacy') return 'privacy';
  if (normalized === '/terms-of-service') return 'terms';
  return null;
};
export const legalTargetFor = (
  route: LegalRoute,
  config: { legalPrivacyUrl?: unknown; legalTermsUrl?: unknown }
): string => {
  const { privacyUrl, termsUrl } = resolveLegalLinks(config);
  return route === 'privacy' ? privacyUrl : termsUrl;
};
