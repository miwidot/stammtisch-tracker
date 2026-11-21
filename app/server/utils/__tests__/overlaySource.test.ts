import { mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchOverlaySource,
  overlayFilePath,
  parseOverlaySourceUrl,
  readOverlayFile,
} from '@/server/utils/overlaySource';
// The OS reclaims the temp directories; tests never delete files.
let root: string;
let outside: string;
beforeEach(async () => {
  const base = await mkdtemp(join(tmpdir(), 'overlay-source-'));
  root = join(base, 'dist');
  outside = join(base, 'secret');
  await mkdir(root);
  await mkdir(outside);
  await writeFile(join(root, 'overlay.json'), '{"ok":true}');
  await writeFile(join(outside, 'overlay.json'), '{"leak":true}');
});
const fileUrl = (path: string) => pathToFileURL(path).href;
describe('parseOverlaySourceUrl', () => {
  it.each([
    'https://overlay.example.com/overlay.json',
    'http://127.0.0.1/overlay.json',
    'http://127.0.0.1:8080/overlay.json',
    'http://localhost:3000/overlay.json',
    'http://[::1]/overlay.json',
  ])('accepts %s', (value) => {
    expect(parseOverlaySourceUrl(value, undefined)).toBe(new URL(value).toString());
  });
  it.each([
    undefined,
    '',
    '   ',
    'not-a-url',
    'http://overlay.example.com/overlay.json',
    'http://127.0.0.1.evil.com/overlay.json',
    'http://localhost.evil.com/overlay.json',
    'http://0.0.0.0/overlay.json',
    'http://[::ffff:127.0.0.1]/overlay.json',
    'http://user:pw@127.0.0.1/overlay.json',
    'https://user:pw@overlay.example.com/overlay.json',
    'ftp://127.0.0.1/overlay.json',
    'javascript:alert(1)',
    'data:application/json,{}',
    'file://remote-host/dist/overlay.json',
  ])('rejects %j', (value) => {
    expect(parseOverlaySourceUrl(value, root)).toBeNull();
  });
  it('refuses every file URL while OVERLAY_FILE_ROOT is unset or relative', () => {
    const url = fileUrl(join(root, 'overlay.json'));
    expect(parseOverlaySourceUrl(url, undefined)).toBeNull();
    expect(parseOverlaySourceUrl(url, '')).toBeNull();
    expect(parseOverlaySourceUrl(url, '  ')).toBeNull();
    expect(parseOverlaySourceUrl(url, 'dist')).toBeNull();
  });
  it('accepts a file URL inside the configured root', () => {
    const url = fileUrl(join(root, 'overlay.json'));
    expect(parseOverlaySourceUrl(url, root)).toBe(url);
    expect(parseOverlaySourceUrl(url, `${root}/`)).toBe(url);
  });
});
describe('overlayFilePath traversal and shape checks', () => {
  const check = (value: string) => overlayFilePath(new URL(value), root);
  it.each([
    ['dot-dot segment', () => `file://${root}/../secret/overlay.json`],
    ['encoded dot-dot', () => `file://${root}/%2e%2e/secret/overlay.json`],
    ['encoded slash', () => `file://${root}%2F..%2Fsecret%2Foverlay.json`],
    ['sibling prefix directory', () => fileUrl(join(`${root}-evil`, 'overlay.json'))],
    ['the root itself', () => fileUrl(root)],
    ['a non-json file', () => fileUrl(join(root, 'overlay.txt'))],
    ['an extensionless file', () => fileUrl(join(root, 'passwd'))],
    ['a null byte', () => `file://${root}/overlay.json%00.txt`],
    ['a UNC-style host', () => `file://evil.example${root}/overlay.json`],
    ['an absolute path outside', () => 'file:///etc/passwd'],
  ])('rejects %s', (_label, build) => {
    const value = build();
    expect(value && check(value)).toBeFalsy();
  });
  it('treats a double-encoded dot-dot as a literal file name inside the root, not a traversal', () => {
    const path = check(`file://${root}/%252e%252e/secret/overlay.json`);
    expect(path?.startsWith(`${root}/`)).toBe(true);
    expect(path).toContain('%2e%2e');
  });
  it('is not fooled by a query or fragment', () => {
    const path = check(`${fileUrl(join(root, 'overlay.json'))}?v=1#frag`);
    expect(path).toBe(join(root, 'overlay.json'));
  });
});
describe('readOverlayFile', () => {
  it('returns the file as a 200 JSON response', async () => {
    const response = await readOverlayFile(fileUrl(join(root, 'overlay.json')), root);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });
  it('answers a missing file with 404', async () => {
    const response = await readOverlayFile(fileUrl(join(root, 'missing.json')), root);
    expect(response.status).toBe(404);
  });
  it('answers a missing root with 404 instead of throwing', async () => {
    const response = await readOverlayFile(fileUrl(join(root, 'nope', 'overlay.json')), root);
    expect(response.status).toBe(404);
  });
  it('refuses a symlink that leads out of the root', async () => {
    await symlink(join(outside, 'overlay.json'), join(root, 'link.json'));
    await expect(readOverlayFile(fileUrl(join(root, 'link.json')), root)).rejects.toThrow(
      'overlay_file_outside_root'
    );
  });
  it('refuses a directory named like an overlay', async () => {
    await mkdir(join(root, 'dir.json'));
    await expect(readOverlayFile(fileUrl(join(root, 'dir.json')), root)).rejects.toThrow(
      'overlay_file_not_regular'
    );
  });
  it('refuses a path outside the root and an unset root', async () => {
    await expect(readOverlayFile(fileUrl(join(outside, 'overlay.json')), root)).rejects.toThrow(
      'overlay_file_not_allowed'
    );
    await expect(readOverlayFile(fileUrl(join(root, 'overlay.json')), undefined)).rejects.toThrow(
      'overlay_file_not_allowed'
    );
  });
});
describe('fetchOverlaySource', () => {
  it('reads file URLs without any network request', async () => {
    vi.stubEnv('OVERLAY_FILE_ROOT', root);
    const network = vi.spyOn(globalThis, 'fetch');
    const response = await fetchOverlaySource(fileUrl(join(root, 'overlay.json')), {});
    expect(await response.json()).toEqual({ ok: true });
    expect(network).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
  it('delegates http(s) URLs to fetch', async () => {
    const network = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    await fetchOverlaySource('http://127.0.0.1/overlay.json', { redirect: 'manual' });
    expect(network).toHaveBeenCalledWith('http://127.0.0.1/overlay.json', { redirect: 'manual' });
  });
});
