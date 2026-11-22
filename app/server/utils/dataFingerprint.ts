import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { basename } from 'node:path';
import { kvFilePath } from '@/server/utils/localDirKv';
import { createLogger } from '@/server/utils/logger';
import { DEFAULT_URL as DEFAULT_NEUTRAL_OVERLAY_URL } from '@/server/utils/neutralOverlay';
import { DEFAULT_OVERLAY_URL } from '@/server/utils/overlay';
import { overlayAuthHeaders } from '@/server/utils/overlayAuth';
import {
  fetchOverlaySource,
  isFileOverlayUrl,
  parseOverlaySourceUrl,
} from '@/server/utils/overlaySource';
import { TARKOVTRACKER_USER_AGENT } from '@/server/utils/userAgent';
import { CATALOG_MANIFEST_KEY } from '@/utils/catalogDatasets';
/**
 * Fork (FORK.md 3.16): one cheap token that changes whenever any served game data changes.
 * Inputs: the producer release (target of the `TARKOV_DATA_DIR` symlink plus its manifest),
 * the content of the overlay and neutral overlay sources, and the app build id. Only a
 * truncated hash leaves this module, so no path or URL can leak through the endpoint.
 */
const FINGERPRINT_TTL_MS = 5_000;
const LOCAL_SOURCE_TTL_MS = 5_000;
const REMOTE_SOURCE_TTL_MS = 60_000;
const SOURCE_TIMEOUT_MS = 5_000;
const FINGERPRINT_LENGTH = 32;
const UNAVAILABLE = 'unavailable';
const logger = createLogger('DataFingerprint');
const sha256 = (value: string | Uint8Array): string =>
  createHash('sha256').update(value).digest('hex');
type SourceHash = { hash: string; at: number };
const sourceHashes = new Map<string, SourceHash>();
let memo: { buildId: string; value: string; at: number } | undefined;
/** Test hook: forget memoized hashes so a changed file is seen immediately. */
export function resetDataFingerprintCache(): void {
  sourceHashes.clear();
  memo = undefined;
}
async function readReleaseId(): Promise<string> {
  const dir = process.env.TARKOV_DATA_DIR?.trim();
  if (!dir) return 'none';
  try {
    const release = basename(await realpath(dir));
    let manifest = UNAVAILABLE;
    try {
      manifest = sha256(await readFile(kvFilePath(dir, CATALOG_MANIFEST_KEY)));
    } catch {
      // A release without a readable manifest still differs from one with it.
    }
    return `${release}:${manifest}`;
  } catch (error) {
    logger.warn('Producer release is not readable', error);
    return UNAVAILABLE;
  }
}
async function hashSource(url: string): Promise<string> {
  const response = await fetchOverlaySource(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS),
    headers: {
      Accept: 'application/json',
      'User-Agent': TARKOVTRACKER_USER_AGENT,
      ...overlayAuthHeaders(url),
    },
  });
  if (!response.ok) throw new Error(`overlay source answered ${response.status}`);
  return sha256(new Uint8Array(await response.arrayBuffer()));
}
async function sourceHash(url: string | null, now: number): Promise<string> {
  if (!url) return UNAVAILABLE;
  const known = sourceHashes.get(url);
  const local = isFileOverlayUrl(url) || new URL(url).protocol === 'http:';
  if (known && now - known.at < (local ? LOCAL_SOURCE_TTL_MS : REMOTE_SOURCE_TTL_MS))
    return known.hash;
  try {
    const hash = await hashSource(url);
    sourceHashes.set(url, { hash, at: now });
    return hash;
  } catch (error) {
    logger.warn('Overlay source is not readable for the data fingerprint', error);
    // Keep the last good hash: a flaky source must not look like a data change.
    if (known) {
      sourceHashes.set(url, { hash: known.hash, at: now });
      return known.hash;
    }
    return UNAVAILABLE;
  }
}
export async function readDataFingerprint(buildId: string, now = Date.now()): Promise<string> {
  if (memo && memo.buildId === buildId && now - memo.at < FINGERPRINT_TTL_MS) return memo.value;
  const overlayUrl = parseOverlaySourceUrl(process.env.OVERLAY_URL || DEFAULT_OVERLAY_URL);
  const neutralUrl = parseOverlaySourceUrl(
    process.env.NEUTRAL_OVERLAY_URL || DEFAULT_NEUTRAL_OVERLAY_URL
  );
  const [release, overlay, neutral] = await Promise.all([
    readReleaseId(),
    sourceHash(overlayUrl, now),
    sourceHash(neutralUrl, now),
  ]);
  const value = sha256(JSON.stringify([release, overlay, neutral, buildId])).slice(
    0,
    FINGERPRINT_LENGTH
  );
  memo = { buildId, value, at: now };
  return value;
}
