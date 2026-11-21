import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
const load = async () => (await import('@/server/utils/neutralOverlay')).fetchNeutralOverlay;
describe('neutral overlay source (fork)', () => {
  it('fetches a loopback http URL', async () => {
    vi.stubEnv('NEUTRAL_OVERLAY_URL', 'http://127.0.0.1:8080/overlay-neutral.json');
    const fetchMock = vi.fn(async () => new Response(null, { status: 404 }));
    vi.stubGlobal('fetch', fetchMock as typeof fetch);
    await expect((await load())(true)).rejects.toThrow('Neutral overlay unavailable (404)');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8080/overlay-neutral.json',
      expect.any(Object)
    );
  });
  it.each([
    'http://overlay.example.com/overlay-neutral.json',
    'http://127.0.0.1.evil.com/overlay-neutral.json',
    'http://user:pw@127.0.0.1/overlay-neutral.json',
    'ftp://127.0.0.1/overlay-neutral.json',
    'file:///etc/passwd',
  ])('rejects %s without any request', async (value) => {
    vi.stubEnv('NEUTRAL_OVERLAY_URL', value);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock as typeof fetch);
    await expect((await load())(true)).rejects.toThrow('Neutral overlay requires');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('reads a file under OVERLAY_FILE_ROOT locally and reports a missing file as 404', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'neutral-file-'));
    vi.stubEnv('OVERLAY_FILE_ROOT', dir);
    vi.stubEnv('NEUTRAL_OVERLAY_URL', pathToFileURL(join(dir, 'overlay-neutral.json')).href);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock as typeof fetch);
    await expect((await load())(true)).rejects.toThrow('Neutral overlay unavailable (404)');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('rejects a file outside OVERLAY_FILE_ROOT', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'neutral-file-'));
    vi.stubEnv('OVERLAY_FILE_ROOT', dir);
    vi.stubEnv('NEUTRAL_OVERLAY_URL', 'file:///etc/hosts.json');
    await expect((await load())(true)).rejects.toThrow('Neutral overlay requires');
  });
});
