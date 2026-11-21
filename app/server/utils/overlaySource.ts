import { realpath, stat, readFile } from 'node:fs/promises';
import { extname, isAbsolute, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isLoopbackHostname } from '@/server/utils/loopbackHost';
/**
 * Fork deviation (see FORK.md): where the server may read the overlay JSON from.
 *
 * Upstream only accepts `https:`. On our box nginx already serves the overlay files, so an
 * https URL sends the request out through Cloudflare and straight back. Two extra sources keep
 * the traffic on the machine:
 *  - `http:` to a loopback host only (never credentials, never a public name);
 *  - `file:` to a regular `.json` file below the directory named in `OVERLAY_FILE_ROOT`. A file
 *    URL is refused whenever that variable is unset, so no deployment can read local files by
 *    accident. The path is checked lexically and again after resolving symlinks.
 * Everything else is rejected and the caller falls back to its trusted default.
 */
export const OVERLAY_FILE_ROOT_ENV = 'OVERLAY_FILE_ROOT';
/** The producer's overlay is a few MB; anything near this is a wrong file, not an overlay. */
const MAX_OVERLAY_FILE_BYTES = 64 * 1024 * 1024;
const OVERLAY_FILE_EXTENSION = '.json';
const hasCredentials = (url: URL): boolean => Boolean(url.username || url.password);
/**
 * Maps a `file:` URL to an absolute path inside `root`, or `null` when the URL names anything
 * else: a remote host, an encoded separator, a path outside the root, or a non-`.json` name.
 * `fileURLToPath` rejects `%2F`, and the WHATWG parser has already resolved `..` segments, so the
 * containment check below is the second layer rather than the only one.
 */
export function overlayFilePath(url: URL, root: string | undefined): string | null {
  const trimmedRoot = root?.trim();
  if (!trimmedRoot || url.protocol !== 'file:' || url.hostname || hasCredentials(url)) return null;
  let path: string;
  try {
    path = fileURLToPath(url);
  } catch {
    return null;
  }
  if (path.includes('\0')) return null;
  if (!isAbsolute(trimmedRoot)) return null;
  const base = resolve(trimmedRoot);
  const target = resolve(path);
  if (!target.startsWith(base + sep)) return null;
  if (extname(target).toLowerCase() !== OVERLAY_FILE_EXTENSION) return null;
  return target;
}
/**
 * Validates a configured overlay source. Returns the normalized URL string, or `null` when it is
 * not an allowed source. Pure and synchronous so it can run at module load.
 */
export function parseOverlaySourceUrl(
  value: string | undefined,
  fileRoot: string | undefined = process.env[OVERLAY_FILE_ROOT_ENV]
): string | null {
  const candidate = value?.trim();
  if (!candidate) return null;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (hasCredentials(url)) return null;
  if (url.protocol === 'https:') return url.toString();
  if (url.protocol === 'http:') return isLoopbackHostname(url.hostname) ? url.toString() : null;
  if (url.protocol === 'file:') return overlayFilePath(url, fileRoot) ? url.toString() : null;
  return null;
}
export const isFileOverlayUrl = (value: string): boolean => value.startsWith('file:');
const notFound = (): Response => new Response(null, { status: 404 });
/**
 * Reads a validated `file:` overlay URL as a `Response`, so callers handle it exactly like an
 * HTTP answer: 404 when the file does not exist, a thrown error for anything suspicious.
 */
export async function readOverlayFile(
  value: string,
  fileRoot: string | undefined = process.env[OVERLAY_FILE_ROOT_ENV]
): Promise<Response> {
  const path = overlayFilePath(new URL(value), fileRoot);
  if (!path || !fileRoot) throw new Error('overlay_file_not_allowed');
  let real: string;
  let realBase: string;
  try {
    [real, realBase] = await Promise.all([realpath(path), realpath(resolve(fileRoot.trim()))]);
  } catch (error) {
    if ((error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') return notFound();
    throw error;
  }
  // A symlink inside the root must not lead out of it.
  if (!real.startsWith(realBase + sep)) throw new Error('overlay_file_outside_root');
  const info = await stat(real);
  if (!info.isFile()) throw new Error('overlay_file_not_regular');
  if (info.size > MAX_OVERLAY_FILE_BYTES) throw new Error('overlay_file_too_large');
  return new Response(await readFile(real), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
/** `fetch` for http(s) sources, a local read for `file:`; callers keep their own redirect logic. */
export function fetchOverlaySource(url: string, init: RequestInit): Promise<Response> {
  return isFileOverlayUrl(url) ? readOverlayFile(url) : fetch(url, init);
}
