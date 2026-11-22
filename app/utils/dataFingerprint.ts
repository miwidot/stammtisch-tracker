import { logger } from '@/utils/logger';
import { tarkovApiFetch } from '@/utils/tarkovApiFetch';
/**
 * Fork (FORK.md 3.16): client side of the server's game data fingerprint. Cached entries carry
 * the fingerprint they were fetched under; a different value (or none) makes them stale even
 * when their TTL has not run out. A failed check never blocks: the cache keeps being used.
 */
export const DATA_FINGERPRINT_ENDPOINT = '/api/tarkov/data-fingerprint';
export const DATA_FINGERPRINT_CHECK_INTERVAL_MS = 60_000;
export const DATA_FINGERPRINT_TIMEOUT_MS = 2_500;
type ChangeListener = (next: string, previous: string) => void;
let current: string | null = null;
let lastCheckAt = 0;
let inflight: Promise<string | null> | null = null;
const listeners = new Set<ChangeListener>();
/** Fingerprint seen by the latest successful check, or null when none succeeded yet. */
export const getKnownDataFingerprint = (): string | null => current;
/** Called when a later check sees a different fingerprint than an earlier one. */
export function onDataFingerprintChange(listener: ChangeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
/** Test hook: forget the known fingerprint, the throttle and all listeners. */
export function resetDataFingerprintState(): void {
  current = null;
  lastCheckAt = 0;
  inflight = null;
  listeners.clear();
}
async function requestFingerprint(): Promise<string | null> {
  try {
    const response = await tarkovApiFetch<{ data?: { fingerprint?: unknown } }>(
      DATA_FINGERPRINT_ENDPOINT,
      { timeout: DATA_FINGERPRINT_TIMEOUT_MS, retry: 0, cache: 'no-store' }
    );
    const next = response?.data?.fingerprint;
    if (typeof next !== 'string' || next.length === 0) {
      logger.warn('[DataFingerprint] Server returned no usable fingerprint');
      return current;
    }
    const previous = current;
    current = next;
    if (previous !== null && previous !== next) {
      for (const listener of listeners) {
        try {
          listener(next, previous);
        } catch (error) {
          logger.error('[DataFingerprint] Change listener failed:', error);
        }
      }
    }
    return current;
  } catch (error) {
    logger.warn('[DataFingerprint] Check failed, keeping cached data:', error);
    return current;
  }
}
/**
 * Resolves the current fingerprint, asking the server at most once per interval (a failed
 * attempt counts). Concurrent callers share one request.
 */
export function checkDataFingerprint(): Promise<string | null> {
  if (inflight) return inflight;
  if (Date.now() - lastCheckAt < DATA_FINGERPRINT_CHECK_INTERVAL_MS) {
    return Promise.resolve(current);
  }
  lastCheckAt = Date.now();
  inflight = requestFingerprint().finally(() => {
    inflight = null;
  });
  return inflight;
}
