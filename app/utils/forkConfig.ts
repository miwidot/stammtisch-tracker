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
/**
 * Fork decision: the top-bar "..." overflow button is hidden on every breakpoint. Upstream uses
 * it to collect theme toggle (n/a here), help, activity log and language switcher when the bar
 * is too narrow for them, so below the wide-bar thresholds those entries are not reachable from
 * the bar. Flip back to `true` to restore upstream's behavior.
 */
export const OVERFLOW_MENU_ENABLED = false;
/**
 * Fork decision: the "Streamer-Modus" (privacy mode) row in the settings "App-Einstellungen" card
 * is hidden. While `false` the preference is also neutralised: `getStreamerMode` resolves to
 * `false`, the sync payload sends `streamer_mode: false`, and a previously stored `true` is
 * cleared on login (see `clearHiddenStreamerMode`). The streamer overlay routes are unaffected.
 * Flip back to `true` to restore upstream's behavior.
 */
export const STREAMER_MODE_PREFERENCE_ENABLED = false;
/**
 * Fork decision: the "antifandom.com verwenden" row is hidden. While `false`,
 * `getWikiUseAntifandom` resolves to upstream's default (`false`), so wiki links keep their
 * original fandom.com host. Flip back to `true` to restore upstream's behavior.
 */
export const ANTIFANDOM_PREFERENCE_ENABLED = false;
