import { createHash, timingSafeEqual } from 'node:crypto';
import { getRequestHeader, readRawBody } from 'h3';
import { useRuntimeConfig } from '#imports';
import { adminSupabaseFetch, normalizeSupabaseUrl } from '@/server/utils/adminSupabase';
import { createLogger } from '@/server/utils/logger';
import { getClientAddress } from '@/server/utils/requestIdentity';
import {
  consumeSharedRateLimitWithReset,
  createSharedCacheHandle,
  getRateLimiterBinding,
} from '@/server/utils/sharedEdgeStore';
import type { H3Event } from 'h3';
/**
 * Fork-only: server-to-server account deletion for the Stammtisch main site.
 *
 * Our users never hold a recent OAuth login (they sign in through the OTP handoff), so
 * upstream's self-service `account-delete` function cannot work for them. Deletion is
 * started on the main site instead, which calls this endpoint with a shared secret. The
 * deletion itself runs in one database transaction (`fork_delete_account`, see the fork
 * migration) that reuses upstream's claim, team-ownership and Auth-delete steps.
 *
 * Contract:
 *   POST /api/fork/account-delete   Authorization: Bearer <secret>   {"userId": "<uuid>"}
 *   200 {ok:true, deleted:true}                          user and tracker data removed
 *   200 {ok:true, deleted:false, reason:"not_found"}     nothing to do (idempotent)
 *   409 {ok:false, deleted:false, reason:"in_progress"}  another deletion holds the lease; retry
 *   409 {ok:false, deleted:false, reason:"storage_owner"} account owns Storage data; clean up first
 *   401 missing credentials, 403 wrong secret, 400 bad body, 413 oversized, 405 wrong method,
 *   429 more than 20 requests per minute from one address,
 *   502 deletion failed (rolled back, logged), 503 not configured
 */
export const FORK_ACCOUNT_DELETE_PATH = '/api/fork/account-delete';
const MIN_SECRET_LENGTH = 32;
const MAX_BODY_BYTES = 1024;
// The only legitimate caller is the main site, a handful of requests per minute at most.
const RATE_LIMIT_PER_MINUTE = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_PREFIX = 'fork-account-delete-rate';
const WRONG_SECRET_LOG_INTERVAL_MS = 60_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const logger = createLogger('ForkAccountDelete');
export interface ForkAccountDeleteResult {
  status: number;
  body: Record<string, unknown>;
  headers?: Record<string, string>;
}
const fail = (
  status: number,
  error: string,
  headers?: Record<string, string>
): ForkAccountDeleteResult => ({ status, body: { ok: false, error }, headers });
let lastWrongSecretLogAt = 0;
let suppressedWrongSecretLogs = 0;
/** At most one warning per interval, so a guessing client cannot flood the log. */
function logWrongSecret(): void {
  const now = Date.now();
  if (lastWrongSecretLogAt !== 0 && now - lastWrongSecretLogAt < WRONG_SECRET_LOG_INTERVAL_MS) {
    suppressedWrongSecretLogs += 1;
    return;
  }
  logger.warn('Rejected fork account deletion with a wrong secret', {
    suppressedSinceLastLog: suppressedWrongSecretLogs,
  });
  lastWrongSecretLogAt = now;
  suppressedWrongSecretLogs = 0;
}
async function isRateLimited(
  event: H3Event,
  config: ReturnType<typeof useRuntimeConfig>
): Promise<{ limited: boolean; retryAfter: number }> {
  const trustProxy = Boolean(
    (config as { apiProtection?: { trustProxy?: boolean } }).apiProtection?.trustProxy
  );
  const handle = createSharedCacheHandle(
    (config.public as { appUrl?: unknown } | undefined)?.appUrl,
    getRateLimiterBinding(event)
  );
  const verdict = await consumeSharedRateLimitWithReset(
    handle,
    RATE_LIMIT_PREFIX,
    `fork-account-delete:ip:${getClientAddress(event, trustProxy) ?? 'unknown'}`,
    RATE_LIMIT_PER_MINUTE,
    RATE_LIMIT_WINDOW_MS,
    (failure) => logger.warn('Fork account deletion rate-limit store failed', failure.error)
  );
  const resetAt = verdict.resetAt ?? Date.now() + RATE_LIMIT_WINDOW_MS;
  return {
    limited: !verdict.allowed,
    retryAfter: Math.min(60, Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))),
  };
}
function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}
function secretMatches(provided: string, expected: string): boolean {
  // Hashing first gives equal-length buffers, so the comparison is constant-time for any input.
  return timingSafeEqual(digest(provided), digest(expected));
}
function readBearer(header: string | undefined): string | null {
  const match = /^Bearer[ ]+(\S+)$/i.exec(header?.trim() ?? '');
  return match?.[1] ?? null;
}
async function readUserId(event: H3Event): Promise<string | null> {
  const declared = Number(getRequestHeader(event, 'content-length') ?? 0);
  if (declared > MAX_BODY_BYTES) throw new RangeError('payload_too_large');
  const raw = await readRawBody(event, 'utf8');
  if (typeof raw !== 'string' || raw.length === 0) return null;
  if (Buffer.byteLength(raw) > MAX_BODY_BYTES) throw new RangeError('payload_too_large');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const userId = (parsed as { userId?: unknown }).userId;
  return typeof userId === 'string' && UUID.test(userId) ? userId.toLowerCase() : null;
}
function interpretRpcResult(result: unknown, userId: string): ForkAccountDeleteResult {
  const value = result as { deleted?: unknown; reason?: unknown } | null;
  if (value === null || typeof value !== 'object' || typeof value.deleted !== 'boolean') {
    logger.error('Unexpected fork_delete_account response shape', { userId });
    return fail(502, 'delete_failed');
  }
  if (value.deleted) return { status: 200, body: { ok: true, deleted: true } };
  if (value.reason === 'not_found') {
    return { status: 200, body: { ok: true, deleted: false, reason: 'not_found' } };
  }
  logger.warn('Account deletion not started', { userId, reason: String(value.reason) });
  // Retrying cannot help while the account owns Storage data; it needs manual cleanup first.
  const reason = value.reason === 'storage_owner' ? 'storage_owner' : 'in_progress';
  return { status: 409, body: { ok: false, deleted: false, reason } };
}
export async function handleForkAccountDelete(event: H3Event): Promise<ForkAccountDeleteResult> {
  if (event.method !== 'POST') return fail(405, 'method_not_allowed', { Allow: 'POST' });
  const config = useRuntimeConfig(event);
  const secret = String(config.forkAccountDeleteSecret ?? '');
  const supabaseUrl = normalizeSupabaseUrl(config.supabaseUrl);
  const serviceKey = String(config.supabaseServiceKey ?? '');
  // Fail closed: without a strong secret the endpoint does not exist for anyone.
  if (secret.length < MIN_SECRET_LENGTH || !supabaseUrl || !serviceKey) {
    logger.error('Fork account deletion is not configured');
    return fail(503, 'not_configured');
  }
  const rate = await isRateLimited(event, config);
  if (rate.limited) {
    return fail(429, 'too_many_requests', { 'Retry-After': String(rate.retryAfter) });
  }
  const provided = readBearer(getRequestHeader(event, 'authorization'));
  if (provided === null) {
    return fail(401, 'authentication_required', { 'WWW-Authenticate': 'Bearer' });
  }
  if (!secretMatches(provided, secret)) {
    logWrongSecret();
    return fail(403, 'forbidden');
  }
  let userId: string | null;
  try {
    userId = await readUserId(event);
  } catch {
    return fail(413, 'payload_too_large');
  }
  if (userId === null) return fail(400, 'invalid_request');
  try {
    const result = await adminSupabaseFetch<unknown>(
      supabaseUrl,
      serviceKey,
      '/rest/v1/rpc/fork_delete_account',
      { method: 'POST', body: JSON.stringify({ p_user_id: userId }) }
    );
    return interpretRpcResult(result, userId);
  } catch (error) {
    // The transaction rolled back, so nothing is half-deleted; the caller must keep its
    // mapping and retry. adminSupabaseFetch already logged the upstream status.
    logger.error('Fork account deletion failed', { userId, error });
    return fail(502, 'delete_failed');
  }
}
