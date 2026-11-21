import { defineEventHandler, getRequestURL, sendRedirect } from 'h3';
import { useRuntimeConfig } from '#imports';
import { legalTargetFor, matchLegalRoute } from '@/utils/legalLinks';
// Fork-only. Upstream's /privacy and /terms-of-service name upstream's operator, so both answer
// with a 302 to the Stammtisch legal pages. 302 (not 301) so a later change of the target is
// never pinned in browser caches. The target comes only from runtime config. Named `03.` so it
// runs after `02.fork-indexing-policy`, which puts the noindex header on this response too.
export default defineEventHandler((event) => {
  if (event.method !== 'GET' && event.method !== 'HEAD') return;
  const route = matchLegalRoute(getRequestURL(event).pathname);
  if (!route) return;
  return sendRedirect(event, legalTargetFor(route, useRuntimeConfig(event).public), 302);
});
