// @vitest-environment happy-dom
import { mockNuxtImport } from '@nuxt/test-utils/runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import legalRedirect from '@/middleware/legal-redirect.global';
const { navigateToMock, runtimeConfig } = vi.hoisted(() => ({
  navigateToMock: vi.fn((target: string) => ({ redirectedTo: target })),
  runtimeConfig: {
    public: { legalPrivacyUrl: undefined as unknown, legalTermsUrl: undefined as unknown },
  },
}));
mockNuxtImport('navigateTo', () => navigateToMock);
mockNuxtImport('useRuntimeConfig', () => () => runtimeConfig);
mockNuxtImport(
  'defineNuxtRouteMiddleware',
  () => (handler: (...args: unknown[]) => unknown) => handler
);
const visit = (path: string) => (legalRedirect as (to: { path: string }) => unknown)({ path });
describe('legal route middleware (client navigation)', () => {
  beforeEach(() => {
    navigateToMock.mockClear();
    runtimeConfig.public.legalPrivacyUrl = undefined;
    runtimeConfig.public.legalTermsUrl = undefined;
  });
  it.each([
    ['/privacy', 'https://tarkov-stammtisch.de/datenschutz'],
    ['/privacy/', 'https://tarkov-stammtisch.de/datenschutz'],
    ['/Privacy', 'https://tarkov-stammtisch.de/datenschutz'],
    ['/terms-of-service', 'https://tarkov-stammtisch.de/nutzungsbedingungen'],
    ['/terms-of-service/', 'https://tarkov-stammtisch.de/nutzungsbedingungen'],
  ])('sends %s to %s as an external 302', (path, target) => {
    visit(path);
    expect(navigateToMock).toHaveBeenCalledWith(target, { external: true, redirectCode: 302 });
  });
  it('follows the config override', () => {
    runtimeConfig.public.legalPrivacyUrl = 'https://dev.tarkov-stammtisch.de/datenschutz';
    visit('/privacy');
    expect(navigateToMock).toHaveBeenCalledWith('https://dev.tarkov-stammtisch.de/datenschutz', {
      external: true,
      redirectCode: 302,
    });
  });
  it('falls back to the default for an unsafe configured value', () => {
    runtimeConfig.public.legalTermsUrl = 'javascript:alert(1)';
    visit('/terms-of-service');
    expect(navigateToMock.mock.calls[0]?.[0]).toBe(
      'https://tarkov-stammtisch.de/nutzungsbedingungen'
    );
  });
  it('leaves every other route alone', () => {
    for (const path of ['/', '/tasks', '/login', '/privacy-policy', '/resources/privacy']) {
      expect(visit(path)).toBeUndefined();
    }
    expect(navigateToMock).not.toHaveBeenCalled();
  });
});
