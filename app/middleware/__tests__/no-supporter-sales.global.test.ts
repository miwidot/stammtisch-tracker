// @vitest-environment happy-dom
import { mockNuxtImport } from '@nuxt/test-utils/runtime';
import { describe, expect, it, vi } from 'vitest';
import noSupporterSalesMiddleware from '@/middleware/no-supporter-sales.global';
const { createErrorMock } = vi.hoisted(() => ({
  createErrorMock: vi.fn((options: { statusCode: number; statusMessage: string }) => {
    const error = new Error(options.statusMessage) as Error & { statusCode: number };
    error.statusCode = options.statusCode;
    return error;
  }),
}));
mockNuxtImport('createError', () => createErrorMock);
mockNuxtImport(
  'defineNuxtRouteMiddleware',
  () => (handler: (...args: unknown[]) => unknown) => handler
);
function visit(path: string) {
  return () => (noSupporterSalesMiddleware as (to: { path: string }) => unknown)({ path });
}
describe('supporter sales stay disabled on this instance', () => {
  it('answers /supporter with 404 rather than a pricing page', () => {
    expect(visit('/supporter')).toThrow();
    const [options] = createErrorMock.mock.calls.at(-1) ?? [];
    expect(options?.statusCode).toBe(404);
  });
  it('does not redirect, so nothing implies the page moved', () => {
    expect(visit('/supporter')).toThrow(
      expect.objectContaining({ statusCode: 404 }) as unknown as Error
    );
  });
  it('leaves every other route alone', () => {
    for (const path of ['/', '/tasks', '/settings', '/admin', '/supporters', '/supporter/foo']) {
      expect(visit(path)).not.toThrow();
    }
  });
});
