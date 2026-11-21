// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  beginHandoff,
  consumeHandoffState,
  createHandoffState,
  handoffStatesMatch,
  HANDOFF_STATE_STORAGE_KEY,
} from '@/utils/trackerHandoffState';
describe('trackerHandoffState', () => {
  beforeEach(() => window.sessionStorage.clear());
  it('creates unique URL-safe nonces with at least 128 bits of entropy', () => {
    const values = new Set(Array.from({ length: 200 }, createHandoffState));
    expect(values.size).toBe(200);
    for (const value of values) {
      // 32 random bytes is 256 bits; base64url is 43 characters without padding.
      expect(value).toMatch(/^[A-Za-z0-9_-]{43}$/);
    }
  });
  it('stores the nonce and sends it as ?state=, keeping the existing query', () => {
    const url = new URL(
      beginHandoff('https://tarkov-stammtisch.de/api/tracker/handoff?x=1', 'https://tracker.test')
    );
    const stored = window.sessionStorage.getItem(HANDOFF_STATE_STORAGE_KEY);
    expect(stored).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(url.searchParams.get('state')).toBe(stored);
    expect(url.searchParams.get('x')).toBe('1');
    expect(url.origin).toBe('https://tarkov-stammtisch.de');
  });
  it('overwrites a stale nonce and replaces a state already present in the URL', () => {
    window.sessionStorage.setItem(HANDOFF_STATE_STORAGE_KEY, 'old');
    const url = new URL(beginHandoff('https://m.test/h?state=forced', 'https://tracker.test'));
    const stored = window.sessionStorage.getItem(HANDOFF_STATE_STORAGE_KEY);
    expect(stored).not.toBe('old');
    expect(url.searchParams.getAll('state')).toEqual([stored]);
  });
  it('resolves a relative handoff URL against the given origin', () => {
    expect(beginHandoff('/handoff', 'https://tracker.test')).toMatch(
      /^https:\/\/tracker\.test\/handoff\?state=/
    );
  });
  it('throws when sessionStorage cannot be written, so no login starts without a nonce', () => {
    vi.stubGlobal('sessionStorage', {
      setItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
      getItem: () => null,
      removeItem: () => {},
    });
    try {
      expect(() => beginHandoff('https://m.test/h', 'https://tracker.test')).toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('consumes the nonce exactly once', () => {
    window.sessionStorage.setItem(HANDOFF_STATE_STORAGE_KEY, 'abc');
    expect(consumeHandoffState()).toBe('abc');
    expect(consumeHandoffState()).toBeNull();
  });
  it('returns null for an empty or unreadable store', () => {
    expect(consumeHandoffState()).toBeNull();
    window.sessionStorage.setItem(HANDOFF_STATE_STORAGE_KEY, '');
    expect(consumeHandoffState()).toBeNull();
  });
  it.each([
    ['abc', 'abc', true],
    ['abc', 'abd', false],
    ['abc', 'ab', false],
    ['abc', 'abcd', false],
    ['abc', 'ABC', false],
    [null, 'abc', false],
    ['abc', null, false],
    [null, null, false],
    ['', '', false],
  ])('handoffStatesMatch(%j, %j) is %s', (expected, provided, result) => {
    expect(handoffStatesMatch(expected, provided)).toBe(result);
  });
});
