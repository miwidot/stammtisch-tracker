/** Shared by every server-side URL validator that allows plain http for same-box services. */
const LOOPBACK_IPV4 = /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
/**
 * True only for real loopback hosts. Takes `URL.hostname`, which the WHATWG parser has already
 * canonicalized: `2130706433`, `0x7f000001` and `127.1` arrive as `127.0.0.1` (genuinely loopback,
 * and `fetch` connects to that same parsed value), while look-alikes such as `127.0.0.1.evil.com`,
 * `localhost.evil.com`, `0.0.0.0` and IPv4-mapped IPv6 stay non-loopback and are rejected.
 */
export function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '[::1]' || LOOPBACK_IPV4.test(hostname);
}
