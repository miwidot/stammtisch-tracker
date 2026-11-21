import { isAbsolute } from 'node:path';
import { createLogger } from '@/server/utils/logger';
const logger = createLogger('LocalTarkovData');
/**
 * Self-hosted replacement for the Cloudflare KV binding `TARKOV_DATA`.
 * Inactive unless TARKOV_DATA_DIR is set to an absolute directory that the precompute
 * producer filled (`--target=dir:<path>`). A real binding is never overridden.
 */
export default defineNitroPlugin(async (nitroApp) => {
  const dir = process.env.TARKOV_DATA_DIR?.trim();
  if (!dir) return;
  if (!isAbsolute(dir)) {
    logger.error('TARKOV_DATA_DIR must be an absolute path; local data store disabled');
    return;
  }
  const { attachLocalKv, createDirKvReader } = await import('@/server/utils/localDirKv');
  const reader = createDirKvReader(dir);
  nitroApp.hooks.hook('request', (event) => {
    attachLocalKv(event.context, reader);
  });
  logger.info('Serving Tarkov data from local directory');
});
