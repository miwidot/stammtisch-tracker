import { defineEventHandler, setResponseHeaders } from 'h3';
import { readDataFingerprint } from '~/server/utils/dataFingerprint';
// Fork (FORK.md 3.16): the browser compares this token with the one stored next to its cached
// game data and refetches when they differ. Short cache: it must follow a deploy within seconds.
const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=5',
  'Cloudflare-CDN-Cache-Control': 'public, max-age=5',
  Vary: 'Origin',
};
export default defineEventHandler(async (event) => {
  setResponseHeaders(event, CACHE_HEADERS);
  const config = useRuntimeConfig(event);
  const buildId = [config.app?.buildId, config.public.buildCommit, config.public.appVersion]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join('|');
  return { data: { fingerprint: await readDataFingerprint(buildId) } };
});
