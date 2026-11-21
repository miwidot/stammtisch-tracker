import { defineEventHandler, getRequestURL, setResponseHeader, setResponseStatus } from 'h3';
import {
  FORK_ACCOUNT_DELETE_PATH,
  handleForkAccountDelete,
} from '@/server/utils/forkAccountDelete';
// Fork-only. Named `01.` so it runs before `api-protection`: that middleware only accepts a
// Supabase user token on non-public routes, while this endpoint authenticates the Stammtisch
// main site with a shared secret and answers the request itself.
export default defineEventHandler(async (event) => {
  if (getRequestURL(event).pathname !== FORK_ACCOUNT_DELETE_PATH) return;
  const result = await handleForkAccountDelete(event);
  setResponseStatus(event, result.status);
  setResponseHeader(event, 'Cache-Control', 'no-store');
  for (const [name, value] of Object.entries(result.headers ?? {})) {
    setResponseHeader(event, name, value);
  }
  return result.body;
});
