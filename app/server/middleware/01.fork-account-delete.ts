import {
  createError,
  defineEventHandler,
  getRequestURL,
  setResponseHeader,
  setResponseStatus,
} from 'h3';
import {
  FORK_ACCOUNT_DELETE_PATH,
  handleForkAccountDelete,
} from '@/server/utils/forkAccountDelete';
import { isDirectLoopbackRequest } from '@/server/utils/loopbackOnly';
// Fork-only. Named `01.` so it runs before `api-protection`: that middleware only accepts a
// Supabase user token on non-public routes, while this endpoint authenticates the Stammtisch
// main site with a shared secret and answers the request itself.
const MAX_DECODE_ROUNDS = 3;
/** Collapses casing, repeated or backslash separators, trailing slashes and percent-encoding. */
function normalizePath(pathname: string): string {
  let value = pathname;
  for (let round = 0; round < MAX_DECODE_ROUNDS; round += 1) {
    try {
      const decoded = decodeURIComponent(value);
      if (decoded === value) break;
      value = decoded;
    } catch {
      break;
    }
  }
  const collapsed = value.toLowerCase().replace(/[\\/]+/g, '/');
  return collapsed.length > 1 ? collapsed.replace(/\/+$/, '') : collapsed;
}
export default defineEventHandler(async (event) => {
  const { pathname } = getRequestURL(event);
  if (normalizePath(pathname) !== FORK_ACCOUNT_DELETE_PATH) return;
  // First, before the secret and the rate limiter: a remote caller learns nothing about either,
  // and the answer is the same as for an unknown route.
  if (!isDirectLoopbackRequest(event) || pathname !== FORK_ACCOUNT_DELETE_PATH) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' });
  }
  const result = await handleForkAccountDelete(event);
  setResponseStatus(event, result.status);
  setResponseHeader(event, 'Cache-Control', 'no-store');
  for (const [name, value] of Object.entries(result.headers ?? {})) {
    setResponseHeader(event, name, value);
  }
  return result.body;
});
