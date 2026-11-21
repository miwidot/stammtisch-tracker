import { mkdtemp, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDirKvReader } from '@/server/utils/localDirKv';
import { createDirWriter, parseDirTarget } from '../dir-store';
import { KvReadNotFound } from '../kv';
// The OS reclaims the temp directories; tests never delete files.
let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'dir-store-'));
});
describe('createDirWriter', () => {
  it('writes strings and bytes that the app-side reader serves unchanged', async () => {
    const writer = createDirWriter(root);
    const bytes = Uint8Array.from([31, 139, 8, 255, 0]);
    await writer.put('neutral-catalog-v1/tasks-core/regular/abc', bytes, { expirationTtl: 600 });
    await writer.put('neutral-catalog-v1-manifest', '{"completedAt":5}');
    const reader = createDirKvReader(root);
    expect(await reader.get('neutral-catalog-v1-manifest', 'json')).toEqual({ completedAt: 5 });
    const stream = await reader.get('neutral-catalog-v1/tasks-core/regular/abc', 'stream');
    expect(new Uint8Array(await new Response(stream).arrayBuffer())).toEqual(bytes);
  });
  it('reads back the exact bytes for the publication readback check', async () => {
    const writer = createDirWriter(root);
    const bytes = Uint8Array.from([0, 1, 2, 254, 255]);
    await writer.put('k', bytes);
    expect(new Uint8Array(await writer.read('k'))).toEqual(bytes);
  });
  it('reports a missing key as KvReadNotFound so the readback loop can retry', async () => {
    await expect(createDirWriter(root).read('nothing')).rejects.toBeInstanceOf(KvReadNotFound);
  });
  it('overwrites an existing key and leaves no temp files behind', async () => {
    const writer = createDirWriter(root);
    await writer.put('k', 'first');
    await writer.put('k', 'second');
    expect(await readFile(join(root, 'k'), 'utf8')).toBe('second');
    expect(await readdir(root)).toEqual(['k']);
  });
  it('creates the target directory when it does not exist yet', async () => {
    const writer = createDirWriter(join(root, 'nested', 'data'));
    await writer.put('k', 'v');
    expect(await createDirKvReader(join(root, 'nested', 'data')).get('k', 'text')).toBe('v');
  });
  it.each(['../escape', '..', 'a/../../escape', '/tmp/escape', '%2e%2e%2fescape', '', 'k\0x'])(
    'refuses to write or read the unsafe key %j',
    async (key) => {
      const writer = createDirWriter(root);
      await expect(writer.put(key, 'x')).rejects.toThrow();
      await expect(writer.read(key)).rejects.toThrow();
      expect(await readdir(root)).toEqual([]);
    }
  );
});
describe('parseDirTarget', () => {
  it('returns null when no target is given so the Cloudflare writer stays the default', () => {
    expect(parseDirTarget(undefined)).toBeNull();
    expect(parseDirTarget('')).toBeNull();
  });
  it('extracts the absolute directory', () => {
    expect(parseDirTarget('dir:/var/lib/tarkov-data')).toBe('/var/lib/tarkov-data');
  });
  it.each(['dir:', 'dir:relative/path', 'dir:./x', 'kv:/x', 'file:/x', 'DIR:/x', '/var/data'])(
    'rejects the malformed target %j instead of silently using Cloudflare',
    (target) => {
      expect(() => parseDirTarget(target)).toThrow();
    }
  );
});
