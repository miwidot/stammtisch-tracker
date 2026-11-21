import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LEGAL_PRIVACY_URL,
  DEFAULT_LEGAL_TERMS_URL,
  legalTargetFor,
  matchLegalRoute,
  resolveLegalLinks,
  resolveLegalUrl,
} from '@/utils/legalLinks';
describe('legal link defaults', () => {
  it('point at the Stammtisch main site pages that exist (datenschutz, nutzungsbedingungen)', () => {
    expect(DEFAULT_LEGAL_PRIVACY_URL).toBe('https://tarkov-stammtisch.de/datenschutz');
    expect(DEFAULT_LEGAL_TERMS_URL).toBe('https://tarkov-stammtisch.de/nutzungsbedingungen');
  });
});
describe('resolveLegalUrl', () => {
  const fallback = 'https://tarkov-stammtisch.de/datenschutz';
  it('accepts an https override', () => {
    expect(resolveLegalUrl('https://dev.tarkov-stammtisch.de/datenschutz', fallback)).toBe(
      'https://dev.tarkov-stammtisch.de/datenschutz'
    );
  });
  it('trims whitespace around the override', () => {
    expect(resolveLegalUrl('  https://example.org/x  ', fallback)).toBe('https://example.org/x');
  });
  it.each([
    undefined,
    null,
    '',
    '   ',
    42,
    {},
    'not a url',
    '/datenschutz',
    '//evil.example/x',
    'http://tarkov-stammtisch.de/datenschutz',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'ftp://example.org/x',
    'https://user:pass@example.org/x',
    'https://user@example.org/x',
  ])('falls back for the unsafe or invalid value %j', (value) => {
    expect(resolveLegalUrl(value, fallback)).toBe(fallback);
  });
});
describe('resolveLegalLinks', () => {
  it('uses defaults for an empty config', () => {
    expect(resolveLegalLinks({})).toEqual({
      privacyUrl: DEFAULT_LEGAL_PRIVACY_URL,
      termsUrl: DEFAULT_LEGAL_TERMS_URL,
    });
  });
  it('overrides each target independently', () => {
    expect(
      resolveLegalLinks({ legalPrivacyUrl: 'https://example.org/p', legalTermsUrl: 'bad' })
    ).toEqual({ privacyUrl: 'https://example.org/p', termsUrl: DEFAULT_LEGAL_TERMS_URL });
  });
});
describe('matchLegalRoute', () => {
  it.each([
    ['/privacy', 'privacy'],
    ['/privacy/', 'privacy'],
    ['/privacy///', 'privacy'],
    ['/Privacy', 'privacy'],
    ['/PRIVACY/', 'privacy'],
    ['/terms-of-service', 'terms'],
    ['/terms-of-service/', 'terms'],
    ['/Terms-Of-Service', 'terms'],
  ])('matches %s', (path, expected) => {
    expect(matchLegalRoute(path)).toBe(expected);
  });
  it.each([
    '/',
    '',
    '/privacy-policy',
    '/privacy/extra',
    '/privacy.html',
    '/x/privacy',
    '//privacy',
    '/terms',
    '/terms-of-service-2',
    '/resources/privacy',
    '/api/privacy',
  ])('leaves %s alone', (path) => {
    expect(matchLegalRoute(path)).toBeNull();
  });
});
describe('legalTargetFor', () => {
  it('maps each route to its configured target', () => {
    const config = {
      legalPrivacyUrl: 'https://example.org/p',
      legalTermsUrl: 'https://example.org/t',
    };
    expect(legalTargetFor('privacy', config)).toBe('https://example.org/p');
    expect(legalTargetFor('terms', config)).toBe('https://example.org/t');
  });
});
