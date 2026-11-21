/**
 * Filesystem-backed stand-in for the read side of the Cloudflare KV namespace `TARKOV_DATA`,
 * used when the app runs on the Nitro `node-server` preset (see plugins/local-tarkov-data.ts).
 * The producer (scripts/precompute/dir-store.ts) shares `kvFilePath` so reader and writer can
 * never disagree on the key-to-file mapping.
 *
 * Layout: one flat directory, one file per key, file name = percent-encoded key with dots also
 * encoded. A key therefore can never introduce a path separator, a "." / ".." name, or a hidden
 * file, and the producer's temp files (leading ".") can never collide with a key.
 *
 * Deliberate difference from KV: no expiration. A stale snapshot keeps being served instead of
 * turning into a 503 when the producer stops; pruning old objects is an operations task.
 */
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
/** Cloudflare KV limits keys to 512 bytes. */
const MAX_KEY_BYTES = 512;
/** Most filesystems cap a single file name at 255 bytes. */
const MAX_FILE_NAME_LENGTH = 255;
const MAX_DECODE_ROUNDS = 2;
// eslint-disable-next-line no-control-regex -- control characters are exactly what is rejected
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const DRIVE_PREFIX = /^[a-zA-Z]:/;
export type LocalKvReader = {
  get: {
    (key: string, type: 'json'): Promise<unknown>;
    (key: string, type?: 'text'): Promise<string | null>;
    (key: string, type: 'stream'): Promise<ReadableStream<Uint8Array> | null>;
  };
};
function hasTraversal(candidate: string): boolean {
  if (CONTROL_CHARS.test(candidate) || candidate.startsWith('/') || candidate.startsWith('\\'))
    return true;
  if (DRIVE_PREFIX.test(candidate)) return true;
  return candidate.split(/[/\\]/).some((segment) => segment === '.' || segment === '..');
}
/** Rejects keys that are not plain object names, including percent-encoded traversal. */
export function assertSafeKvKey(key: unknown): asserts key is string {
  if (typeof key !== 'string' || key.length === 0) throw new Error('Invalid KV key');
  if (Buffer.byteLength(key) > MAX_KEY_BYTES) throw new Error('KV key too long');
  let candidate = key;
  for (let round = 0; round <= MAX_DECODE_ROUNDS; round++) {
    if (hasTraversal(candidate)) throw new Error('Unsafe KV key');
    let decoded: string;
    try {
      decoded = decodeURIComponent(candidate);
    } catch {
      return;
    }
    if (decoded === candidate) return;
    candidate = decoded;
  }
}
/** Maps a KV key to the absolute file inside `root`; throws for unsafe keys. */
export function kvFilePath(root: string, key: unknown): string {
  assertSafeKvKey(key);
  const name = encodeURIComponent(key).replaceAll('.', '%2E');
  if (name.length > MAX_FILE_NAME_LENGTH) throw new Error('KV key too long for a file name');
  const base = resolve(root);
  const path = resolve(base, name);
  if (dirname(path) !== base || !path.startsWith(base + sep)) throw new Error('Unsafe KV key');
  return path;
}
function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT';
}
/** Read-only KV lookalike: `get(key, 'json' | 'text' | 'stream')`, `null` for missing keys. */
export function createDirKvReader(root: string): LocalKvReader {
  async function get(key: string, type: string = 'text'): Promise<unknown> {
    if (type !== 'json' && type !== 'text' && type !== 'stream')
      throw new TypeError(`Unsupported KV read type "${String(type)}"`);
    const path = kvFilePath(root, key);
    try {
      if (type === 'stream') return await openStream(path);
      const text = await readFile(path, 'utf8');
      return type === 'json' ? JSON.parse(text) : text;
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
  }
  return { get } as LocalKvReader;
}
/** Resolves only after the file opened, so a missing file surfaces as ENOENT here. */
async function openStream(path: string): Promise<ReadableStream<Uint8Array>> {
  // Opening a directory succeeds and only fails on the first read, after headers were sent.
  if (!(await stat(path)).isFile()) throw new Error('KV object is not a regular file');
  return new Promise((resolveStream, reject) => {
    const file = createReadStream(path);
    file.once('open', () => resolveStream(Readable.toWeb(file) as ReadableStream<Uint8Array>));
    file.once('error', reject);
  });
}
/**
 * The slice of the Nitro event context this module touches. The index signature is what makes
 * `H3EventContext` (a `Record<string, any>`) assignable: without it TypeScript treats the
 * all-optional type as a weak type and rejects an argument that shares no property with it (TS2559).
 */
type EventContext = {
  cloudflare?: { env?: Record<string, unknown> } & Record<string, unknown>;
  [key: string]: unknown;
};
/** Adds the reader as `TARKOV_DATA` unless a real binding is already present. */
export function attachLocalKv(context: EventContext, reader: LocalKvReader): void {
  if (context.cloudflare?.env?.TARKOV_DATA) return;
  context.cloudflare = {
    ...context.cloudflare,
    env: { ...context.cloudflare?.env, TARKOV_DATA: reader },
  };
}
