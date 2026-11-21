// @vitest-environment happy-dom
/**
 * Login CSRF protection: the handoff token is redeemed only when its fragment echoes the
 * one-time `state` nonce the login page left in this tab's sessionStorage.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HANDOFF_STATE_STORAGE_KEY } from '@/utils/trackerHandoffState';
const { loggerMock } = vi.hoisted(() => ({
  loggerMock: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));
vi.mock('@/utils/logger', () => ({ logger: loggerMock }));
const NONCE = 'pending-nonce-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const SECRET_TOKEN = 'secret-token-value-123';
const setHash = (hash: string) => window.history.replaceState(null, '', `/tasks${hash}`);
const fragment = (token: string | null, state: string | null) =>
  `#${[
    token === null ? '' : `tracker_token=${token}`,
    state === null ? '' : `tracker_state=${state}`,
  ]
    .filter(Boolean)
    .join('&')}`;
type Session = { user: { id: string } } | null;
const makeApp = (session: Session = null) => {
  const verifyOtp = vi.fn().mockResolvedValue({ data: {}, error: null });
  const getSession = vi.fn().mockResolvedValue({ data: { session }, error: null });
  const ready = vi.fn().mockResolvedValue(null);
  const replace = vi.fn().mockResolvedValue(undefined);
  const hooks: Array<() => unknown> = [];
  const nuxtApp = {
    $supabase: { client: { auth: { verifyOtp, getSession } }, ready },
    $router: { currentRoute: { value: { hash: '', path: '/tasks', query: {} } }, replace },
    hook: (_name: string, fn: () => unknown) => hooks.push(fn),
  };
  return { nuxtApp, verifyOtp, getSession, ready, replace, hooks };
};
const run = async (nuxtApp: unknown) => {
  const plugin = (await import('@/plugins/tracker-handoff.client')).default;
  await plugin.setup?.(nuxtApp as Parameters<NonNullable<typeof plugin.setup>>[0]);
};
const pendingNonce = () => window.sessionStorage.getItem(HANDOFF_STATE_STORAGE_KEY);
const loggedText = () =>
  JSON.stringify([...loggerMock.warn.mock.calls, ...loggerMock.error.mock.calls]);
const openedLogin = (replace: ReturnType<typeof vi.fn>) =>
  replace.mock.calls.some(([target]) => (target as { path?: string }).path === '/login');
describe('tracker handoff state nonce', () => {
  beforeEach(() => {
    vi.resetModules();
    Object.values(loggerMock).forEach((fn) => fn.mockClear());
    window.sessionStorage.clear();
    setHash('');
  });
  afterEach(() => {
    window.sessionStorage.clear();
    setHash('');
  });
  it('redeems a token whose state matches the nonce of this tab, then clears the nonce', async () => {
    window.sessionStorage.setItem(HANDOFF_STATE_STORAGE_KEY, NONCE);
    setHash(fragment(SECRET_TOKEN, NONCE));
    const { nuxtApp, verifyOtp, replace } = makeApp();
    await run(nuxtApp);
    expect(verifyOtp).toHaveBeenCalledExactlyOnceWith({ token_hash: SECRET_TOKEN, type: 'email' });
    expect(pendingNonce()).toBeNull();
    expect(window.location.hash).toBe('');
    expect(openedLogin(replace)).toBe(false);
  });
  it('does not redeem without a state in the fragment, clears the fragment and opens /login', async () => {
    window.sessionStorage.setItem(HANDOFF_STATE_STORAGE_KEY, NONCE);
    setHash(fragment(SECRET_TOKEN, null));
    const { nuxtApp, verifyOtp, ready, replace } = makeApp();
    await run(nuxtApp);
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(ready).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('');
    expect(openedLogin(replace)).toBe(true);
    expect(loggerMock.warn).toHaveBeenCalled();
    expect(loggedText()).not.toContain(SECRET_TOKEN);
  });
  it.each([
    ['a different nonce', `${NONCE.slice(0, -1)}B`],
    ['a prefix of the nonce', NONCE.slice(0, 10)],
    ['the nonce with extra characters', `${NONCE}x`],
    ['the nonce in another case', NONCE.toUpperCase()],
    ['an encoded-looking value', '%2e%2e%2f'],
  ])('does not redeem with %s and consumes the pending nonce', async (_label, state) => {
    window.sessionStorage.setItem(HANDOFF_STATE_STORAGE_KEY, NONCE);
    setHash(fragment(SECRET_TOKEN, state));
    const { nuxtApp, verifyOtp, replace } = makeApp();
    await run(nuxtApp);
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(pendingNonce()).toBeNull();
    expect(window.location.hash).toBe('');
    expect(openedLogin(replace)).toBe(true);
    expect(loggedText()).not.toContain(SECRET_TOKEN);
    expect(loggedText()).not.toContain(NONCE);
  });
  it('does not redeem when this tab never started a login, however the state looks', async () => {
    setHash(fragment(SECRET_TOKEN, 'attacker-chosen-state'));
    const { nuxtApp, verifyOtp, replace } = makeApp();
    await run(nuxtApp);
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('');
    expect(openedLogin(replace)).toBe(true);
  });
  it('does not accept an empty state against an empty store', async () => {
    setHash('#tracker_token=abc&tracker_state=');
    const { nuxtApp, verifyOtp } = makeApp();
    await run(nuxtApp);
    expect(verifyOtp).not.toHaveBeenCalled();
  });
  it('refuses a replay: the same fragment cannot be redeemed twice', async () => {
    window.sessionStorage.setItem(HANDOFF_STATE_STORAGE_KEY, NONCE);
    const first = makeApp();
    setHash(fragment(SECRET_TOKEN, NONCE));
    await run(first.nuxtApp);
    expect(first.verifyOtp).toHaveBeenCalledTimes(1);
    vi.resetModules();
    const second = makeApp();
    setHash(fragment(SECRET_TOKEN, NONCE));
    await run(second.nuxtApp);
    expect(second.verifyOtp).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('');
  });
  it.each([
    ['a session of another user', { user: { id: 'someone-else' } }],
    ['a session of the same user', { user: { id: 'same-user' } }],
  ])('keeps %s and does not redeem', async (_label, session) => {
    window.sessionStorage.setItem(HANDOFF_STATE_STORAGE_KEY, NONCE);
    setHash(fragment(SECRET_TOKEN, NONCE));
    const { nuxtApp, verifyOtp } = makeApp(session);
    await run(nuxtApp);
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(pendingNonce()).toBeNull();
    expect(window.location.hash).toBe('');
    expect(loggedText()).not.toContain(SECRET_TOKEN);
  });
  it('treats a failing session read as no session and still redeems', async () => {
    window.sessionStorage.setItem(HANDOFF_STATE_STORAGE_KEY, NONCE);
    setHash(fragment(SECRET_TOKEN, NONCE));
    const { nuxtApp, verifyOtp, getSession } = makeApp();
    getSession.mockRejectedValueOnce(new Error('storage blocked'));
    await run(nuxtApp);
    expect(verifyOtp).toHaveBeenCalledTimes(1);
  });
  it('clears the nonce and the fragment when the auth server rejects the token', async () => {
    window.sessionStorage.setItem(HANDOFF_STATE_STORAGE_KEY, NONCE);
    setHash(fragment(SECRET_TOKEN, NONCE));
    const { nuxtApp, verifyOtp } = makeApp();
    verifyOtp.mockResolvedValueOnce({ data: {}, error: { message: 'Token has expired' } });
    await run(nuxtApp);
    expect(pendingNonce()).toBeNull();
    expect(window.location.hash).toBe('');
  });
  it('clears the nonce and the fragment when redeeming throws', async () => {
    window.sessionStorage.setItem(HANDOFF_STATE_STORAGE_KEY, NONCE);
    setHash(fragment(SECRET_TOKEN, NONCE));
    const { nuxtApp, verifyOtp } = makeApp();
    verifyOtp.mockRejectedValueOnce(new TypeError('fetch failed'));
    await run(nuxtApp);
    expect(pendingNonce()).toBeNull();
    expect(window.location.hash).toBe('');
    expect(loggedText()).not.toContain(SECRET_TOKEN);
  });
  it('consumes the nonce even when the fragment carries a state but no token', async () => {
    window.sessionStorage.setItem(HANDOFF_STATE_STORAGE_KEY, NONCE);
    setHash(`#tracker_token=&tracker_state=${NONCE}`);
    const { nuxtApp, verifyOtp } = makeApp();
    await run(nuxtApp);
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(pendingNonce()).toBeNull();
    expect(window.location.hash).toBe('');
  });
  it('leaves a pending nonce and the page alone when there is no handoff fragment', async () => {
    window.sessionStorage.setItem(HANDOFF_STATE_STORAGE_KEY, NONCE);
    setHash('#section');
    const { nuxtApp, verifyOtp, replace } = makeApp();
    await run(nuxtApp);
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(pendingNonce()).toBe(NONCE);
    expect(replace).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('#section');
  });
  it('also keeps the fragment out of the replayed initial route on a refused token', async () => {
    window.sessionStorage.setItem(HANDOFF_STATE_STORAGE_KEY, NONCE);
    setHash(fragment(SECRET_TOKEN, 'wrong'));
    const { nuxtApp, hooks } = makeApp();
    await run(nuxtApp);
    expect(hooks.length).toBeGreaterThan(0);
    for (const hook of hooks) await hook();
    expect(window.location.hash).toBe('');
  });
});
