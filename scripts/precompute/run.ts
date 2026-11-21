/**
 * Publish neutral catalogs, per-language strings, and whole English import snapshots.
 *
 * Invoked by .github/workflows/precompute-tarkov-data.yml on a 12h schedule
 * and via workflow_dispatch. Filtered runs refresh selected English imports only.
 * Filters arrive as env vars
 * (PRECOMPUTE_LANG / PRECOMPUTE_GAME_MODE) so workflow_dispatch inputs never
 * pass through a shell, or as --lang / --game-mode flags for local runs.
 *
 * Required env (default target, Cloudflare KV):
 *   CLOUDFLARE_API_TOKEN        - scoped to Workers KV Storage: Edit
 *   CLOUDFLARE_ACCOUNT_ID       - account that owns the namespace
 *   TARKOV_DATA_KV_NAMESPACE_ID - id of the TARKOV_DATA namespace
 *
 * Self-hosted target: `--target=dir:/absolute/path` (or PRECOMPUTE_TARGET) writes the same
 * objects to a directory that the node-server app reads via TARKOV_DATA_DIR. No Cloudflare
 * credentials are needed then.
 */
import { writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import * as catalogBuilders from '@/server/utils/neutralCatalog';
import { fetchNeutralOverlay } from '@/server/utils/neutralOverlay';
import { catalogReleaseReport } from './catalog-release';
import { createDirWriter, parseDirTarget } from './dir-store';
import { runImportPrecompute } from './import-snapshots';
import { createKvRestWriter } from './kv';
import { validatePrecomputeFilter } from './precompute';
function fail(message: string): never {
  console.error(`[precompute] ${message}`);
  process.exit(1);
}
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) fail(`Missing required environment variable ${name}`);
  return value;
}
async function writeReport(report: Record<string, unknown>) {
  try {
    await writeFile(
      'precompute-manifest.json',
      JSON.stringify({ completedAt: Date.now(), ...report }, null, 2)
    );
  } catch (error) {
    console.warn('[precompute] Could not write local diagnostic manifest:', error);
  }
}
const { values: flags } = parseArgs({
  options: {
    'game-mode': { type: 'string' },
    lang: { type: 'string' },
    target: { type: 'string' },
  },
});
const filter = {
  gameMode: flags['game-mode'] || process.env.PRECOMPUTE_GAME_MODE || undefined,
  lang: flags.lang || process.env.PRECOMPUTE_LANG || undefined,
};
const filterError = validatePrecomputeFilter(filter);
if (filterError) fail(filterError);
function createStore() {
  const dir = parseDirTarget(flags.target || process.env.PRECOMPUTE_TARGET || undefined);
  if (dir) return createDirWriter(dir);
  return createKvRestWriter({
    accountId: requireEnv('CLOUDFLARE_ACCOUNT_ID'),
    apiToken: requireEnv('CLOUDFLARE_API_TOKEN'),
    namespaceId: requireEnv('TARKOV_DATA_KV_NAMESPACE_ID'),
  });
}
const kv = (() => {
  try {
    return createStore();
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
})();
try {
  const snapshot = await fetchNeutralOverlay();
  const sha = snapshot.meta.sha256;
  if (!sha || (process.env.EXPECTED_OVERLAY_SHA && sha !== process.env.EXPECTED_OVERLAY_SHA))
    throw new Error('Neutral overlay differs from the requested release');
  const imports = await runImportPrecompute(kv, filter, sha);
  const full = !filter.lang && !filter.gameMode;
  const neutral =
    full && !imports.failures.length
      ? await catalogReleaseReport(kv, catalogBuilders, sha)
      : undefined;
  await writeReport({ imports, ...neutral });
  console.log(
    JSON.stringify({
      catalogObjects: Object.keys(neutral?.catalogRelease?.entries ?? {}).length,
      imports,
      catalogReleaseError: neutral?.catalogReleaseError,
    })
  );
  if (neutral?.catalogReleaseError || imports.failures.length) process.exitCode = 1;
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  await writeReport({ error: message });
  fail(message);
}
