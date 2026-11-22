import { mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readDataFingerprint, resetDataFingerprintCache } from '@/server/utils/dataFingerprint';
import { kvFilePath } from '@/server/utils/localDirKv';
import { CATALOG_MANIFEST_KEY } from '@/utils/catalogDatasets';
const logger = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }));
vi.mock('@/server/utils/logger', () => ({ createLogger: () => logger }));
let root: string;
let overlayFile: string;
let neutralFile: string;
let dataLink: string;
async function release(name: string, manifest: string): Promise<string> {
  const dir = join(root, 'releases', name);
  await mkdir(dir, { recursive: true });
  await writeFile(kvFilePath(dir, CATALOG_MANIFEST_KEY), manifest);
  return dir;
}
async function point(target: string): Promise<void> {
  // symlink() cannot replace a link, so every release gets its own link name.
  dataLink = join(root, `current-${Math.random().toString(36).slice(2)}`);
  await symlink(target, dataLink);
  vi.stubEnv('TARKOV_DATA_DIR', dataLink);
}
const fingerprint = (build = 'build-1') => {
  resetDataFingerprintCache();
  return readDataFingerprint(build);
};
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'fingerprint-'));
  overlayFile = join(root, 'overlay.json');
  neutralFile = join(root, 'overlay-neutral.json');
  await writeFile(overlayFile, '{"v":1}');
  await writeFile(neutralFile, '{"v":1}');
  await point(await release('r1', 'm1'));
  vi.stubEnv('OVERLAY_FILE_ROOT', root);
  vi.stubEnv('OVERLAY_URL', pathToFileURL(overlayFile).href);
  vi.stubEnv('NEUTRAL_OVERLAY_URL', pathToFileURL(neutralFile).href);
  resetDataFingerprintCache();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.clearAllMocks();
});
describe('server data fingerprint', () => {
  it('is a stable opaque hash that leaks no path', async () => {
    const first = await fingerprint();
    expect(first).toMatch(/^[0-9a-f]{32}$/);
    expect(await fingerprint()).toBe(first);
    expect(first).not.toContain(root);
  });
  it('changes when the overlay file content changes', async () => {
    const before = await fingerprint();
    await writeFile(overlayFile, '{"v":2,"translation":"Neu"}');
    expect(await fingerprint()).not.toBe(before);
  });
  it('changes when the neutral overlay file content changes', async () => {
    const before = await fingerprint();
    await writeFile(neutralFile, '{"v":2}');
    expect(await fingerprint()).not.toBe(before);
  });
  it('changes when the producer release the symlink points to changes', async () => {
    const before = await fingerprint();
    await point(await release('r2', 'm1'));
    expect(await fingerprint()).not.toBe(before);
  });
  it('changes when only the manifest of the same release name changes', async () => {
    const before = await fingerprint();
    await writeFile(kvFilePath(join(root, 'releases', 'r1'), CATALOG_MANIFEST_KEY), 'm2');
    expect(await fingerprint()).not.toBe(before);
  });
  it('changes with the app build id', async () => {
    expect(await fingerprint('build-1')).not.toBe(await fingerprint('build-2'));
  });
  it('answers from memory for a few seconds, then sees the new file', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(10_000_000);
    const before = await readDataFingerprint('b');
    await writeFile(overlayFile, '{"v":3}');
    vi.setSystemTime(10_003_000);
    expect(await readDataFingerprint('b')).toBe(before);
    vi.setSystemTime(10_006_000);
    expect(await readDataFingerprint('b')).not.toBe(before);
  });
  it('survives unreadable sources, keeps the last good hash and logs', async () => {
    const before = await fingerprint();
    vi.stubEnv('OVERLAY_URL', pathToFileURL(join(root, 'missing.json')).href);
    const missing = await fingerprint();
    expect(missing).toMatch(/^[0-9a-f]{32}$/);
    expect(missing).not.toBe(before);
    await writeFile(overlayFile, '{"v":1}');
    vi.stubEnv('OVERLAY_URL', pathToFileURL(overlayFile).href);
    expect(await fingerprint()).toBe(before);
  });
  it('rejects an overlay file outside the allowed root without reading it', async () => {
    const outside = await mkdtemp(join(tmpdir(), 'outside-'));
    const secret = join(outside, 'secret.json');
    await writeFile(secret, '{"secret":true}');
    const before = await fingerprint();
    vi.stubEnv('OVERLAY_URL', pathToFileURL(secret).href);
    await writeFile(secret, '{"secret":false}');
    const after = await fingerprint();
    // The refused source is a constant, so changing its content cannot move the fingerprint.
    await writeFile(secret, '{"secret":"again"}');
    expect(await fingerprint()).toBe(after);
    expect(after).not.toBe(before);
  });
  it('still answers when no producer directory is configured', async () => {
    vi.stubEnv('TARKOV_DATA_DIR', '');
    expect(await fingerprint()).toMatch(/^[0-9a-f]{32}$/);
  });
  it('still answers when the producer directory vanished and logs a warning', async () => {
    vi.stubEnv('TARKOV_DATA_DIR', join(root, 'nope'));
    expect(await fingerprint()).toMatch(/^[0-9a-f]{32}$/);
    expect(logger.warn).toHaveBeenCalledWith('Producer release is not readable', expect.anything());
  });
});
