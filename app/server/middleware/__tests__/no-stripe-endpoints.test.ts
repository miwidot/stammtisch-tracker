import { describe, expect, it, vi } from 'vitest';
vi.stubGlobal('defineEventHandler', (handler: unknown) => handler);
const { default: noStripeEndpoints } = await import('../no-stripe-endpoints');
type Handler = (event: { path?: string }) => unknown;
function call(path?: string) {
  return (noStripeEndpoints as Handler)({ path });
}
function statusOf(path: string): number | undefined {
  try {
    call(path);
  } catch (error) {
    return (error as { statusCode?: number }).statusCode;
  }
  return undefined;
}
describe('Stripe endpoints stay closed on this instance', () => {
  it('refuses the checkout endpoint even on a direct POST', () => {
    expect(statusOf('/api/stripe/checkout')).toBe(404);
  });
  it('refuses the billing portal endpoint', () => {
    expect(statusOf('/api/stripe/portal')).toBe(404);
  });
  it('refuses anything else added under the prefix later', () => {
    expect(statusOf('/api/stripe/anything-new')).toBe(404);
  });
  it('leaves the supporter status and its admin override reachable', () => {
    // These carry the gateway tier limits and the Discord role sync; only the
    // purchase surface is closed.
    expect(() => call('/api/admin/supporter')).not.toThrow();
    expect(() => call('/api/progress')).not.toThrow();
  });
  it('does not match a lookalike prefix', () => {
    expect(() => call('/api/stripe-status')).not.toThrow();
  });
  it('survives an event without a path', () => {
    expect(() => call(undefined)).not.toThrow();
  });
});
