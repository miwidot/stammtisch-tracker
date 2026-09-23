/**
 * Fork-only feature flags — behavior that upstream TarkovTracker does not have an opinion on,
 * kept in one dedicated module per flag family so it can be intercepted by a single global
 * Vitest mock (see `tests/fork-test-setup.ts`). Upstream's own tests for a gated feature keep
 * exercising their original, unmodified behavior against the mocked (enabled) value; dedicated
 * fork tests override that mock to exercise this fork's actual (disabled) behavior. Do not
 * inline these flags into the files they gate — the mock interception only works while the flag
 * lives in its own importable module.
 */
/**
 * Fork decision: the light theme (upstream issue #102) is intentionally unreachable. Dark is
 * the Stammtisch design; this repo does not offer a light appearance to users. Flip this back
 * to `true` to fully restore upstream's light-theme behavior (normalization, boot script, and
 * the toggle controls in AppBar/AppearanceCard all key off this flag).
 */
export const LIGHT_THEME_ENABLED = false;
