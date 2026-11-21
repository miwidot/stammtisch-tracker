import { createLogger } from '@/server/utils/logger';
import type { H3Event } from 'h3';
/**
 * Fork-only: gate for endpoints that only the main site on the same box may call.
 *
 * Allowed means the TCP peer is loopback AND the request carries no proxy or forwarding
 * header. nginx also connects from 127.0.0.1, so the peer alone cannot tell a proxied public
 * request from the main site's direct call; nginx always adds forwarding headers, the direct
 * caller never does. Deliberately independent of `API_TRUST_PROXY` and of any header value.
 */
const logger = createLogger('LoopbackOnly');
const FORWARDING_HEADERS = [
  'x-forwarded-for',
  'x-real-ip',
  'cf-connecting-ip',
  'forwarded',
  'x-forwarded-host',
  'x-forwarded-proto',
  'true-client-ip',
] as const;
const IPV4_LOOPBACK = /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
const MAPPED_PREFIX = '::ffff:';
export function isLoopbackAddress(address: string | undefined | null): boolean {
  if (typeof address !== 'string') return false;
  const value = address.toLowerCase();
  if (value === '::1') return true;
  const v4 = value.startsWith(MAPPED_PREFIX) ? value.slice(MAPPED_PREFIX.length) : value;
  return (
    IPV4_LOOPBACK.test(v4) &&
    v4.split('.').every((part) => Number(part) <= 255 && String(Number(part)) === part)
  );
}
/** Names of forwarding headers present on the request, with any value (even empty). */
export function presentForwardingHeaders(event: H3Event): string[] {
  const headers = event.node?.req?.headers ?? {};
  return FORWARDING_HEADERS.filter((name) => Object.prototype.hasOwnProperty.call(headers, name));
}
export function isDirectLoopbackRequest(event: H3Event): boolean {
  const peer = event.node?.req?.socket?.remoteAddress;
  const forwarded = presentForwardingHeaders(event);
  if (isLoopbackAddress(peer) && forwarded.length === 0) return true;
  // Header names and the peer address only, never header values or credentials.
  logger.warn('Rejected loopback-only request', {
    peerLoopback: isLoopbackAddress(peer),
    forwardingHeaders: forwarded,
  });
  return false;
}
