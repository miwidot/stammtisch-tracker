import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { kvFilePath } from '@/server/utils/localDirKv';
import { getPrecomputedStore } from '@/server/utils/precomputedTarkov';
const logger = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }));
vi.mock('@/server/utils/logger', () => ({ createLogger: () => logger }));
type RequestHook = (event: { context: Record<string, unknown> }) => void;
async function loadPlugin() {
  vi.stubGlobal('defineNitroPlugin', (plugin: unknown) => plugin);
  vi.resetModules();
  const mod = (await import('../local-tarkov-data')) as unknown as {
    default: (app: unknown) => Promise<void>;
  };
  const hooks: RequestHook[] = [];
  const nitroApp = {
    hooks: { hook: vi.fn((name: string, fn: RequestHook) => name === 'request' && hooks.push(fn)) },
  };
  await mod.default(nitroApp);
  return { nitroApp, hooks };
}
describe('local-tarkov-data nitro plugin', () => {
  beforeEach(() => {
    vi.stubEnv('TARKOV_DATA_DIR', '');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  it('is inactive when TARKOV_DATA_DIR is unset', async () => {
    vi.stubEnv('TARKOV_DATA_DIR', undefined as unknown as string);
    const { nitroApp, hooks } = await loadPlugin();
    expect(nitroApp.hooks.hook).not.toHaveBeenCalled();
    expect(hooks).toHaveLength(0);
  });
  it.each(['', '   ', '\t\n'])('is inactive for the blank value %j', async (value) => {
    vi.stubEnv('TARKOV_DATA_DIR', value);
    const { hooks } = await loadPlugin();
    expect(hooks).toHaveLength(0);
    expect(logger.error).not.toHaveBeenCalled();
  });
  it.each(['relative/dir', './data', '../data'])(
    'refuses the relative path %j and logs why',
    async (value) => {
      vi.stubEnv('TARKOV_DATA_DIR', value);
      const { hooks } = await loadPlugin();
      expect(hooks).toHaveLength(0);
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('absolute'));
    }
  );
  it('attaches a working TARKOV_DATA reader to each request when configured', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'local-tarkov-plugin-'));
    await writeFile(kvFilePath(dir, 'neutral-catalog-v1-manifest'), '{"completedAt":1}');
    vi.stubEnv('TARKOV_DATA_DIR', ` ${dir} `);
    const { hooks } = await loadPlugin();
    expect(hooks).toHaveLength(1);
    const event = { context: {} as Record<string, unknown> };
    hooks[0]!(event);
    const store = getPrecomputedStore(event);
    expect(await store!.get('neutral-catalog-v1-manifest', 'json')).toEqual({ completedAt: 1 });
    expect(await store!.get('absent', 'json')).toBeNull();
  });
  it('leaves a real Cloudflare binding untouched', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'local-tarkov-plugin-'));
    vi.stubEnv('TARKOV_DATA_DIR', dir);
    const { hooks } = await loadPlugin();
    const real = { get: vi.fn() };
    const event = { context: { cloudflare: { env: { TARKOV_DATA: real, OTHER: 'x' } } } };
    hooks[0]!(event);
    expect(event.context.cloudflare.env.TARKOV_DATA).toBe(real);
    expect(event.context.cloudflare.env.OTHER).toBe('x');
  });
});
