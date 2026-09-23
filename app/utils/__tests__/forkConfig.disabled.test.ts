import { describe, expect, it, vi } from 'vitest';
// This file exists to prove the other half of the override mechanism the light-theme fork tests
// rely on: a test-file-level vi.mock (hoisted, static, at module top level -- the same pattern
// used by app/utils/__tests__/theme.disabled.test.ts and friends) overrides the global
// setup-file mock (tests/fork-test-setup.ts) for the whole file, letting a fork test exercise
// this fork's actual (disabled) behavior. See forkConfig.test.ts for the unmocked-in-this-file
// default.
vi.mock('@/utils/forkConfig', () => ({ LIGHT_THEME_ENABLED: false }));
describe('forkConfig module mock (test-file override)', () => {
  it('a file-level vi.mock overrides the global setup-file mock for that file', async () => {
    const { LIGHT_THEME_ENABLED } = await import('@/utils/forkConfig');
    expect(LIGHT_THEME_ENABLED).toBe(false);
  });
});
