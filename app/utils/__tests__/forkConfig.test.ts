import { describe, expect, it } from 'vitest';
// This file exists to prove one half of the override mechanism the light-theme fork tests rely
// on: without a local override, the global setup-file mock (tests/fork-test-setup.ts) is in
// effect, so upstream's own theme/AppBar/settings tests keep exercising their original behavior
// unmodified. See forkConfig.disabled.test.ts for the other half (a test-file-level vi.mock
// overriding the setup-file mock).
describe('forkConfig module mock (global setup default)', () => {
  it('LIGHT_THEME_ENABLED is mocked true by the global test setup', async () => {
    const { LIGHT_THEME_ENABLED } = await import('@/utils/forkConfig');
    expect(LIGHT_THEME_ENABLED).toBe(true);
  });
});
