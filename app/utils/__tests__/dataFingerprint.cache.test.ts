// @vitest-environment happy-dom
import { mockNuxtImport } from '@nuxt/test-utils/runtime';
import { IDBFactory } from 'fake-indexeddb';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DATA_FINGERPRINT_CHECK_INTERVAL_MS,
  DATA_FINGERPRINT_ENDPOINT,
  checkDataFingerprint,
  onDataFingerprintChange,
  resetDataFingerprintState,
} from '@/utils/dataFingerprint';
import { logger } from '@/utils/logger';
import { localizeMetadata } from '@/utils/metadataLocalization';
import { tarkovApiFetch } from '@/utils/tarkovApiFetch';
import {
  CACHE_CONFIG,
  clearAllCache,
  getCacheStats,
  getCachedData,
  setCachedData,
} from '@/utils/tarkovCache';
vi.mock('@/utils/logger', () => ({
  logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));
vi.mock('@/utils/tarkovApiFetch', async (original) => ({
  ...(await original<typeof import('@/utils/tarkovApiFetch')>()),
  tarkovApiFetch: vi.fn(),
}));
const runtimeConfig = vi.hoisted(() => vi.fn());
mockNuxtImport('useRuntimeConfig', () => runtimeConfig);
const KEY = '@tt:regular:tasks:name';
let fingerprint: string | Error;
let strings: Record<string, string>;
const stringRequests = () =>
  vi.mocked(tarkovApiFetch).mock.calls.filter(([endpoint]) => endpoint === '/api/tarkov/strings');
const fingerprintRequests = () =>
  vi
    .mocked(tarkovApiFetch)
    .mock.calls.filter(([endpoint]) => endpoint === DATA_FINGERPRINT_ENDPOINT);
/** A new page load: module state is gone, IndexedDB survives. */
const reload = () => resetDataFingerprintState();
const translate = (owner: object) => localizeMetadata(owner, { name: KEY }, 'de');
/** setCachedData runs detached after a fetch; wait until its nth write has landed. */
const persisted = (writes = 1) =>
  vi.waitFor(() =>
    expect(
      vi.mocked(logger.debug).mock.calls.filter(([message]) => /Cache STORED/.test(String(message)))
    ).toHaveLength(writes)
  );
beforeAll(() => {
  // The cache module keeps its connection, so one factory serves the whole file.
  vi.stubGlobal('indexedDB', new IDBFactory());
});
beforeEach(async () => {
  await clearAllCache();
  runtimeConfig.mockReturnValue({ public: {} });
  resetDataFingerprintState();
  fingerprint = 'fp-1';
  strings = { [KEY]: 'Alt' };
  vi.mocked(tarkovApiFetch).mockImplementation((async (endpoint: string) => {
    if (endpoint === DATA_FINGERPRINT_ENDPOINT) {
      if (fingerprint instanceof Error) throw fingerprint;
      return { data: { fingerprint } };
    }
    return { data: { strings: { ...strings } } };
  }) as typeof tarkovApiFetch);
});
afterEach(() => {
  vi.restoreAllMocks();
});
afterAll(() => vi.unstubAllGlobals());
describe('game data fingerprint in the client cache', () => {
  it('refetches strings after the data fingerprint changed although the TTL has not expired', async () => {
    expect(await translate({})).toEqual({ name: 'Alt' });
    await persisted();
    expect(stringRequests()).toHaveLength(1);
    reload();
    fingerprint = 'fp-2';
    strings = { [KEY]: 'Neu' };
    expect(await translate({})).toEqual({ name: 'Neu' });
    expect(stringRequests()).toHaveLength(2);
    await persisted(2);
  });
  it('serves the cache without a strings request while the fingerprint is unchanged', async () => {
    await translate({});
    await persisted();
    reload();
    strings = { [KEY]: 'Neu' };
    expect(await translate({})).toEqual({ name: 'Alt' });
    expect(stringRequests()).toHaveLength(1);
  });
  it('treats an entry stored without a fingerprint as stale', async () => {
    fingerprint = new Error('offline');
    await translate({});
    await persisted();
    reload();
    fingerprint = 'fp-1';
    strings = { [KEY]: 'Neu' };
    expect(await translate({})).toEqual({ name: 'Neu' });
    expect(stringRequests()).toHaveLength(2);
    await persisted(2);
  });
  it('keeps using cached data and logs when the fingerprint request fails', async () => {
    await translate({});
    await persisted();
    reload();
    fingerprint = new Error('timeout');
    strings = { [KEY]: 'Neu' };
    expect(await translate({})).toEqual({ name: 'Alt' });
    expect(stringRequests()).toHaveLength(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('[DataFingerprint] Check failed'),
      expect.any(Error)
    );
  });
  it.each([null, '', 42, {}])('ignores an unusable fingerprint payload %j', async (payload) => {
    vi.mocked(tarkovApiFetch).mockResolvedValueOnce({ data: { fingerprint: payload } });
    await setCachedData('strings', 'v', 'de', { a: 'b' });
    expect(await getCachedData('strings', 'v', 'de')).toEqual({ a: 'b' });
  });
  it('notifies listeners only when a later check sees another fingerprint', async () => {
    const listener = vi.fn();
    onDataFingerprintChange(listener);
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    await checkDataFingerprint();
    expect(listener).not.toHaveBeenCalled();
    fingerprint = 'fp-2';
    now.mockReturnValue(1_000_000 + DATA_FINGERPRINT_CHECK_INTERVAL_MS);
    await checkDataFingerprint();
    expect(listener).toHaveBeenCalledExactlyOnceWith('fp-2', 'fp-1');
  });
});
describe('fingerprint check throttle', () => {
  it('asks the server at most once per interval, concurrent callers included', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(5_000_000);
    await Promise.all([checkDataFingerprint(), checkDataFingerprint(), checkDataFingerprint()]);
    await checkDataFingerprint();
    now.mockReturnValue(5_000_000 + DATA_FINGERPRINT_CHECK_INTERVAL_MS - 1);
    await checkDataFingerprint();
    expect(fingerprintRequests()).toHaveLength(1);
    now.mockReturnValue(5_000_000 + DATA_FINGERPRINT_CHECK_INTERVAL_MS);
    await checkDataFingerprint();
    expect(fingerprintRequests()).toHaveLength(2);
  });
  it('does not hammer a failing endpoint', async () => {
    fingerprint = new Error('503');
    vi.spyOn(Date, 'now').mockReturnValue(9_000_000);
    await checkDataFingerprint();
    await checkDataFingerprint();
    expect(fingerprintRequests()).toHaveLength(1);
  });
});
describe('cache TTL override', () => {
  const ttlMinutes = async () => (await getCacheStats()).entries[0]?.ttl;
  it('keeps the upstream 12 h TTL when the override is unset or empty', async () => {
    for (const value of [undefined, '']) {
      runtimeConfig.mockReturnValue({ public: { tarkovDataCacheTtlMs: value } });
      await setCachedData('strings', 'v', 'de', { a: 'b' });
      expect(await ttlMinutes()).toBe(CACHE_CONFIG.DEFAULT_TTL / 60_000);
      expect(await getCachedData('strings', 'v', 'de')).toEqual({ a: 'b' });
    }
  });
  it('0 never persists and never serves an existing entry', async () => {
    await setCachedData('strings', 'v', 'de', { a: 'b' });
    runtimeConfig.mockReturnValue({ public: { tarkovDataCacheTtlMs: '0' } });
    expect(await getCachedData('strings', 'v', 'de')).toBeNull();
    await setCachedData('strings', 'other', 'de', { c: 'd' });
    runtimeConfig.mockReturnValue({ public: {} });
    expect(await getCachedData('strings', 'other', 'de')).toBeNull();
    expect((await getCacheStats()).totalEntries).toBe(1);
  });
  it('0 makes every strings load hit the network', async () => {
    runtimeConfig.mockReturnValue({ public: { tarkovDataCacheTtlMs: 0 } });
    await translate({});
    await translate({});
    expect(stringRequests()).toHaveLength(2);
  });
  it('caps the TTL of new and existing entries at a positive override', async () => {
    await setCachedData('strings', 'old', 'de', { a: 'b' });
    runtimeConfig.mockReturnValue({ public: { tarkovDataCacheTtlMs: 60_000 } });
    await setCachedData('strings', 'new', 'de', { c: 'd' });
    const stats = await getCacheStats();
    expect(stats.entries.find((entry) => entry.cacheKey.includes('-new-'))?.ttl).toBe(1);
    const later = Date.now() + 2 * 60_000;
    vi.spyOn(Date, 'now').mockReturnValue(later);
    expect(await getCachedData('strings', 'old', 'de')).toBeNull();
  });
  it.each(['abc', '-5', 'NaN', 'Infinity'])('ignores the invalid override %j', async (value) => {
    runtimeConfig.mockReturnValue({ public: { tarkovDataCacheTtlMs: value } });
    await setCachedData('strings', 'v', 'de', { a: 'b' });
    expect(await getCachedData('strings', 'v', 'de')).toEqual({ a: 'b' });
  });
});
