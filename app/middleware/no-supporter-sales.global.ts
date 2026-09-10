/**
 * The supporter sales page stays unreachable on this instance.
 *
 * Upstream funds tarkovtracker.org through Stripe subscriptions. This is a
 * private community instance with no payment processing configured, so the
 * pricing page could only ever end in "Checkout failed" — offering something
 * that cannot work is worse than not offering it.
 *
 * The supporter *status* is deliberately kept: it drives the API gateway's
 * per-tier limits and the Discord role sync, and an admin can grant it
 * directly (see AdminSupporterAccessCard). Only the purchase route goes.
 *
 * 404 rather than a redirect: on this instance the page genuinely does not
 * exist, and a redirect would imply it moved.
 */
const DISABLED_ROUTE_PATHS = new Set(['/supporter']);
export default defineNuxtRouteMiddleware((to) => {
  if (DISABLED_ROUTE_PATHS.has(to.path)) {
    throw createError({ statusCode: 404, statusMessage: 'Page Not Found' });
  }
});
