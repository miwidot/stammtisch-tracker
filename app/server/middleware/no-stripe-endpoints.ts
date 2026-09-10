/**
 * Stripe endpoints stay closed on this instance.
 *
 * Companion to the no-supporter-sales route guard: hiding the pricing page is
 * not enough on its own, because the checkout and portal handlers would still
 * accept a direct POST. They cannot complete without Stripe keys, but an
 * endpoint that exists and always fails is a worse answer than one that is
 * honestly absent.
 *
 * Only the purchase surface is closed. The supporter status itself, its admin
 * override and the gateway tier limits are untouched.
 */
export default defineEventHandler((event) => {
  if (event.path?.startsWith('/api/stripe/')) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' });
  }
});
