/**
 * Theme mode primitives for the light/dark appearance toggle.
 *
 * Dark stays the default and is visually unchanged. The selected mode is
 * persisted in its own localStorage key (not the user-scoped preferences
 * store) so the boot script in nuxt.config can apply `data-theme` and
 * `color-scheme` before first paint and avoid a wrong-theme flash.
 */
// LIGHT_THEME_ENABLED is deliberately NOT re-exported here: Nuxt's auto-import scanner treats
// every export under app/utils/*.ts as a global, and a name exported from two files in that
// directory is an auto-import ambiguity (see the `imports:extend` collision guards in
// nuxt.config.ts for prior instances of this). Import it from '@/utils/forkConfig' directly.
import { LIGHT_THEME_ENABLED } from './forkConfig';
export const THEME_STORAGE_KEY: string = 'tt_theme';
export const THEME_MODES = ['dark', 'light'] as const;
export type ThemeMode = (typeof THEME_MODES)[number];
export const DEFAULT_THEME_MODE: ThemeMode = 'dark';
/** Normalize any persisted/unknown value to a supported theme mode. */
export const normalizeThemeMode = (value: unknown): ThemeMode => {
  if (!LIGHT_THEME_ENABLED) return DEFAULT_THEME_MODE;
  return value === 'light' ? 'light' : DEFAULT_THEME_MODE;
};
const resolveStorage = <T>(custom?: T): T | Storage | undefined => {
  if (custom) return custom;
  return typeof window !== 'undefined' ? window.localStorage : undefined;
};
const resolveRootElement = (
  root?: Pick<HTMLElement, 'dataset' | 'style'>
): Pick<HTMLElement, 'dataset' | 'style'> | undefined => {
  if (root) return root;
  return typeof document !== 'undefined' ? document.documentElement : undefined;
};
/** Read the persisted theme mode. Client-only; falls back to dark on any failure. */
export const readStoredThemeMode = (storage?: Pick<Storage, 'getItem'>): ThemeMode => {
  try {
    const store = resolveStorage(storage);
    return normalizeThemeMode(store?.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME_MODE;
  }
};
/** Persist the theme mode for future sessions and the boot script. Client-only. */
export const persistThemeMode = (mode: ThemeMode, storage?: Pick<Storage, 'setItem'>): void => {
  try {
    const store = resolveStorage(storage);
    store?.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Storage may be unavailable (private mode, quota); the session theme still applies.
  }
};
/** Apply the theme mode to the document root. Client-only. */
export const applyThemeMode = (
  mode: ThemeMode,
  root?: Pick<HTMLElement, 'dataset' | 'style'>
): void => {
  const element = resolveRootElement(root);
  if (!element) return;
  try {
    element.dataset.theme = mode;
    element.style.colorScheme = mode;
  } catch {
    // Document may be unavailable or DOM access restricted.
  }
};
/**
 * Synchronous boot script inlined into the document head by nuxt.config. Runs
 * before first paint so returning light-theme users never see a dark flash.
 * Keep in sync with readStoredThemeMode/applyThemeMode.
 *
 * With the light theme disabled, a value stored before this fork decision
 * (e.g. `tt_theme=light` from a trackerdev session under upstream's toggle)
 * is deliberately never read here, so those users see dark immediately with
 * no flash. The stale key is left in localStorage rather than actively wiped
 * on every boot; it is inert everywhere it is read (this script and
 * normalizeThemeMode both ignore it while LIGHT_THEME_ENABLED is false).
 */
export const THEME_BOOT_SCRIPT: string = [
  '(function(){',
  `var t=${JSON.stringify(DEFAULT_THEME_MODE)};`,
  ...(LIGHT_THEME_ENABLED
    ? [
        'try{',
        `var s=window.localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});`,
        'if(s==="light"||s==="dark"){t=s;}',
        '}catch(e){}',
      ]
    : []),
  'var e=document.documentElement;',
  'e.setAttribute("data-theme",t);',
  'e.style.colorScheme=t;',
  '})();',
].join('');
