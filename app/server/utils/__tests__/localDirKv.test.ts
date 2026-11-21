import { mkdir, mkdtemp, readdir, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  assertSafeKvKey,
  attachLocalKv,
  createDirKvReader,
  kvFilePath,
} from '@/server/utils/localDirKv';
import { getPrecomputedStore } from '@/server/utils/precomputedTarkov';
// The OS reclaims the temp directories; tests never delete files.
let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'local-dir-kv-'));
});
const UNSAFE_KEYS: [string, unknown][] = [
  ['empty key', ''],
  ['non-string key', 42],
  ['null key', null],
  ['undefined key', undefined],
  ['parent segment', '../secret'],
  ['bare parent', '..'],
  ['bare current dir', '.'],
  ['embedded parent', 'a/../b'],
  ['trailing parent', 'a/..'],
  ['backslash parent', '..\\secret'],
  ['embedded backslash parent', 'a\\..\\b'],
  ['absolute posix path', '/etc/passwd'],
  ['absolute windows path', '\\windows\\system32'],
  ['windows drive path', 'C:\\windows'],
  ['percent-encoded parent', '%2e%2e%2fsecret'],
  ['upper-case percent-encoded parent', '%2E%2E%2Fsecret'],
  ['double-encoded parent', '%252e%252e%252fsecret'],
  ['percent-encoded absolute path', '%2fetc%2fpasswd'],
  ['percent-encoded backslash parent', '%2e%2e%5csecret'],
  ['NUL byte', 'key\0.json'],
  ['encoded NUL byte', 'key%00.json'],
  ['newline', 'key\nother'],
  ['over 512 bytes', 'k'.repeat(513)],
  ['over 512 bytes as multibyte', '\u00e4'.repeat(257)],
];
describe('kv key safety', () => {
  it.each(UNSAFE_KEYS)('rejects %s in kvFilePath', (_name, key) => {
    expect(() => kvFilePath(root, key)).toThrow();
  });
  it.each(UNSAFE_KEYS)('rejects %s on read for every read type', async (_name, key) => {
    const reader = createDirKvReader(root);
    for (const type of ['json', 'text', 'stream'] as const)
      await expect(reader.get(key as string, type as 'json')).rejects.toThrow();
  });
  it('accepts the key shapes the application really uses', () => {
    for (const key of [
      'neutral-catalog-v1-manifest',
      'tasks-import-json-v1-en-pvp-season',
      `neutral-catalog-v1/tasks-core/pvp-season/${'a'.repeat(64)}`,
      'file.with.dots',
      'a%zz',
    ])
      expect(() => assertSafeKvKey(key)).not.toThrow();
  });
  it('maps every key to one flat file directly inside the root', () => {
    const path = kvFilePath(root, 'neutral-catalog-v1/items/regular/abc');
    expect(path.startsWith(root + '/')).toBe(true);
    expect(path.slice(root.length + 1)).not.toContain('/');
    expect(path.slice(root.length + 1).startsWith('.')).toBe(false);
  });
  it('keeps keys that differ only by encoding on distinct files', () => {
    expect(kvFilePath(root, 'A')).not.toBe(kvFilePath(root, '%41'));
    expect(kvFilePath(root, 'a/b')).not.toBe(kvFilePath(root, 'a%2Fb'));
  });
  it('never reads outside the root even when a sibling file exists', async () => {
    const outside = await mkdtemp(join(tmpdir(), 'local-dir-kv-outside-'));
    await writeFile(join(outside, 'secret'), 'top secret');
    const inner = join(root, 'data');
    await mkdir(inner);
    const reader = createDirKvReader(inner);
    await expect(reader.get(`../${outside.split('/').pop()}/secret`, 'text')).rejects.toThrow();
    await expect(reader.get(join(outside, 'secret'), 'text')).rejects.toThrow();
  });
});
describe('createDirKvReader', () => {
  it('returns null for a missing key for every read type', async () => {
    const reader = createDirKvReader(root);
    expect(await reader.get('missing', 'json')).toBeNull();
    expect(await reader.get('missing', 'text')).toBeNull();
    expect(await reader.get('missing', 'stream')).toBeNull();
    expect(await reader.get('missing')).toBeNull();
  });
  it('returns null when the whole data directory does not exist yet', async () => {
    const reader = createDirKvReader(join(root, 'not-created'));
    expect(await reader.get('neutral-catalog-v1-manifest', 'json')).toBeNull();
  });
  it('parses json, returns text and defaults to text', async () => {
    await writeFile(kvFilePath(root, 'doc'), '{"a":[1,2],"b":"ä"}');
    const reader = createDirKvReader(root);
    expect(await reader.get('doc', 'json')).toEqual({ a: [1, 2], b: 'ä' });
    expect(await reader.get('doc', 'text')).toBe('{"a":[1,2],"b":"ä"}');
    expect(await reader.get('doc')).toBe('{"a":[1,2],"b":"ä"}');
  });
  it('returns an empty string for an empty file rather than null', async () => {
    await writeFile(kvFilePath(root, 'empty'), '');
    expect(await createDirKvReader(root).get('empty', 'text')).toBe('');
  });
  it('streams the exact bytes as a web ReadableStream', async () => {
    const bytes = Uint8Array.from({ length: 300_000 }, (_, i) => i % 251);
    await writeFile(kvFilePath(root, 'neutral-catalog-v1/x/y'), bytes);
    const stream = await createDirKvReader(root).get('neutral-catalog-v1/x/y', 'stream');
    expect(stream).toBeInstanceOf(ReadableStream);
    const received = new Uint8Array(await new Response(stream).arrayBuffer());
    expect(received).toEqual(bytes);
  });
  it('throws on corrupt json like KV does instead of returning null', async () => {
    await writeFile(kvFilePath(root, 'broken'), '{"a":');
    await expect(createDirKvReader(root).get('broken', 'json')).rejects.toThrow(SyntaxError);
  });
  it('rejects unsupported read types', async () => {
    const reader = createDirKvReader(root) as unknown as {
      get: (k: string, t: string) => Promise<unknown>;
    };
    await expect(reader.get('doc', 'arrayBuffer')).rejects.toThrow(TypeError);
    await expect(reader.get('doc', '__proto__')).rejects.toThrow(TypeError);
  });
  it('surfaces non-ENOENT filesystem errors instead of reporting a miss', async () => {
    await mkdir(kvFilePath(root, 'is-a-directory'));
    const reader = createDirKvReader(root);
    await expect(reader.get('is-a-directory', 'text')).rejects.toThrow();
    await expect(reader.get('is-a-directory', 'stream')).rejects.toThrow();
  });
  it('does not follow a planted symlink out of the key space by key name', async () => {
    const outside = await mkdtemp(join(tmpdir(), 'local-dir-kv-link-'));
    await writeFile(join(outside, 'x'), 'outside');
    // Planting links needs write access to the data directory, which is outside the threat model;
    // the reader only guarantees that key names cannot select a path.
    await symlink(outside, join(root, 'link'));
    await expect(createDirKvReader(root).get('link/x', 'text')).resolves.toBeNull();
    expect(await readdir(root)).toEqual(['link']);
  });
});
describe('attachLocalKv', () => {
  it('exposes the reader through the existing production lookup', async () => {
    await writeFile(kvFilePath(root, 'k'), '{"ok":true}');
    const context: Record<string, unknown> = {};
    attachLocalKv(context, createDirKvReader(root));
    const store = getPrecomputedStore({ context });
    expect(store).not.toBeNull();
    expect(await store!.get('k', 'json')).toEqual({ ok: true });
  });
  it('keeps other Cloudflare context and env entries', () => {
    const context = { cloudflare: { env: { OTHER: 1 }, context: { waitUntil: () => undefined } } };
    attachLocalKv(context, createDirKvReader(root));
    expect(context.cloudflare.env).toMatchObject({ OTHER: 1 });
    expect(context.cloudflare.context.waitUntil).toBeTypeOf('function');
    expect((context.cloudflare.env as Record<string, unknown>).TARKOV_DATA).toBeDefined();
  });
  it('never replaces a real binding', () => {
    const real = { get: () => Promise.resolve(null) };
    const context = { cloudflare: { env: { TARKOV_DATA: real } } };
    attachLocalKv(context, createDirKvReader(root));
    expect(context.cloudflare.env.TARKOV_DATA).toBe(real);
  });
});
