import { legalTargetFor, matchLegalRoute } from '@/utils/legalLinks';
// Fork: client-side navigation and SSR fallback for the redirect that the server middleware
// `03.fork-legal-redirect` performs on direct requests. Target from runtime config only.
export default defineNuxtRouteMiddleware((to) => {
  const route = matchLegalRoute(to.path);
  if (!route) return;
  return navigateTo(legalTargetFor(route, useRuntimeConfig().public), {
    external: true,
    redirectCode: 302,
  });
});
