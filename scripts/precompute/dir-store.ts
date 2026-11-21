/**
 * Directory writer for self-hosted deployments: the counterpart of the Cloudflare KV REST
 * writer in kv.ts. Files land where app/server/utils/localDirKv.ts reads them.
 *
 * Writes go to a temp file and are renamed into place, so a reader never sees a partial object
 * and the manifest pointer (written last by the release pipeline) flips atomically.
 * `expirationTtl` is accepted for interface parity and ignored; see localDirKv.ts.
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { kvFilePath } from '@/server/utils/localDirKv';
import { KvReadNotFound } from './kv';
import type { CatalogStore } from './kv';
export function createDirWriter(root: string): CatalogStore {
  return {
    async read(key) {
      try {
        const bytes = await readFile(kvFilePath(root, key));
        return bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength
        ) as ArrayBuffer;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT')
          throw new KvReadNotFound(`KV read failed for "${key}": not found`);
        throw error;
      }
    },
    async put(key, value) {
      const target = kvFilePath(root, key);
      await mkdir(dirname(target), { recursive: true });
      // Encoded key names never start with "." so a temp name cannot collide with a key.
      const temp = join(
        dirname(target),
        `.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`
      );
      await writeFile(temp, value);
      await rename(temp, target);
    },
  };
}
/** Parses `dir:/absolute/path`; returns null for any other target (Cloudflare KV). */
export function parseDirTarget(target: string | undefined): string | null {
  if (!target) return null;
  if (!target.startsWith('dir:')) throw new Error(`Unsupported precompute target "${target}"`);
  const path = target.slice('dir:'.length);
  if (!path.startsWith('/')) throw new Error('dir: target requires an absolute path');
  return path;
}
