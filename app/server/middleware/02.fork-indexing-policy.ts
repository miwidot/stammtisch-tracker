import { defineEventHandler, setResponseHeader } from 'h3';
import { useRuntimeConfig } from '#imports';
import { isIndexingAllowed, NOINDEX_DIRECTIVE } from '@/utils/indexingPolicy';
// Fork: keeps search engines out of every dynamic response and of prerendered pages that are
// not served as exact static files. Static files (`/`, `/robots.txt`) get the same header from
// `routeRules` in nuxt.config.ts. Switch: NUXT_PUBLIC_ALLOW_INDEXING=true, see indexingPolicy.ts.
export default defineEventHandler((event) => {
  if (isIndexingAllowed(useRuntimeConfig(event).public.allowIndexing)) return;
  setResponseHeader(event, 'X-Robots-Tag', NOINDEX_DIRECTIVE);
});
