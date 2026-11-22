// @vitest-environment happy-dom
import { mockNuxtImport } from '@nuxt/test-utils/runtime';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { H3Event } from 'h3';
const { setResponseHeadersMock, readMock, runtimeConfig } = vi.hoisted(() => ({
  setResponseHeadersMock: vi.fn(),
  readMock: vi.fn(),
  runtimeConfig: vi.fn(),
}));
mockNuxtImport('useRuntimeConfig', () => runtimeConfig);
vi.mock('h3', async (original) => ({
  ...(await original<typeof import('h3')>()),
  setResponseHeaders: setResponseHeadersMock,
}));
vi.mock('~/server/utils/dataFingerprint', () => ({ readDataFingerprint: readMock }));
afterEach(() => {
  vi.clearAllMocks();
});
describe('/api/tarkov/data-fingerprint', () => {
  it('returns only the fingerprint, caches it for seconds and keys it to the build', async () => {
    runtimeConfig.mockReturnValue({
      app: { buildId: 'abc' },
      public: { buildCommit: '', appVersion: '1.2.3' },
    });
    readMock.mockResolvedValue('f'.repeat(32));
    const { default: handler } = await import('@/server/api/tarkov/data-fingerprint.get');
    const event = {} as H3Event;
    expect(await handler(event)).toEqual({ data: { fingerprint: 'f'.repeat(32) } });
    expect(readMock).toHaveBeenCalledWith('abc|1.2.3');
    expect(setResponseHeadersMock).toHaveBeenCalledWith(
      event,
      expect.objectContaining({ 'Cache-Control': 'public, max-age=5' })
    );
  });
});
