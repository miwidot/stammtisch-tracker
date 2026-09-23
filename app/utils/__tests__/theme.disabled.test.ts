// @vitest-environment happy-dom
// Fork decision: the light theme (upstream issue #102) is disabled via app/utils/forkConfig.ts.
// This file mocks the real (disabled) flag value, overriding the global setup default
// (tests/fork-test-setup.ts, LIGHT_THEME_ENABLED=true) that lets app/utils/__tests__/theme.test.ts
// keep exercising upstream's original enabled-light-theme behavior unmodified. These tests assert
// the actual runtime behavior of the exported primitives with the flag off, not a hardcoded
// assumption -- if the fork ever re-enables the light theme, this whole file is a deliberate
// signal to revisit.
//
// THEME_BOOT_SCRIPT is a string baked once, at module top-level evaluation. To guarantee every
// test sees a module instance built under THIS file's mock (and never a copy cached/pre-bundled
// under the global setup's LIGHT_THEME_ENABLED=true default), every import below is a fresh
// dynamic import after vi.resetModules() rather than a static top-of-file import.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installThrowingStorageStub } from '#tests/test-helpers/storageStub';
vi.mock('@/utils/forkConfig', () => ({ LIGHT_THEME_ENABLED: false }));
const importTheme = async () => {
  vi.resetModules();
  return import('@/utils/theme');
};
describe('theme utils, light theme disabled (fork decision)', () => {
  let restoreStorage: (() => void) | undefined;
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = '';
  });
  afterEach(() => {
    restoreStorage?.();
    restoreStorage = undefined;
    vi.restoreAllMocks();
  });
  it('the mocked flag matches the real, unmocked module value', async () => {
    const real = await vi.importActual<typeof import('@/utils/forkConfig')>('@/utils/forkConfig');
    expect(real.LIGHT_THEME_ENABLED).toBe(false);
  });
  it('normalizeThemeMode always resolves to dark, including for "light"', async () => {
    const { normalizeThemeMode } = await importTheme();
    expect(normalizeThemeMode('light')).toBe('dark');
    expect(normalizeThemeMode('dark')).toBe('dark');
    expect(normalizeThemeMode(null)).toBe('dark');
    expect(normalizeThemeMode(undefined)).toBe('dark');
    expect(normalizeThemeMode('')).toBe('dark');
    expect(normalizeThemeMode('   ')).toBe('dark');
    expect(normalizeThemeMode('LIGHT')).toBe('dark');
    expect(normalizeThemeMode('solarized')).toBe('dark');
  });
  it('readStoredThemeMode ignores a persisted "light" value', async () => {
    const { readStoredThemeMode, THEME_STORAGE_KEY } = await importTheme();
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    expect(readStoredThemeMode()).toBe('dark');
  });
  it('THEME_BOOT_SCRIPT applies dark even when a legacy "light" value is stored', async () => {
    const { THEME_BOOT_SCRIPT, THEME_STORAGE_KEY } = await importTheme();
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    new Function(THEME_BOOT_SCRIPT)();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });
  it('THEME_BOOT_SCRIPT never reads localStorage while the flag is off', async () => {
    const { THEME_BOOT_SCRIPT } = await importTheme();
    const getItemSpy = vi.fn(() => 'light');
    const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: { getItem: getItemSpy },
    });
    restoreStorage = () => {
      if (originalDescriptor) {
        Object.defineProperty(window, 'localStorage', originalDescriptor);
      } else {
        Reflect.deleteProperty(window, 'localStorage');
      }
    };
    new Function(THEME_BOOT_SCRIPT)();
    expect(getItemSpy).not.toHaveBeenCalled();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
  it('THEME_BOOT_SCRIPT tolerates a broken localStorage.getItem (private mode/quota)', async () => {
    // Even though the flag being off means the script never calls getItem today, this proves the
    // script itself has no unguarded localStorage access left that a future edit could reintroduce
    // without a test catching it.
    const { THEME_BOOT_SCRIPT } = await importTheme();
    restoreStorage = installThrowingStorageStub();
    expect(() => new Function(THEME_BOOT_SCRIPT)()).not.toThrow();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
describe('nuxt.config.ts wires the real (unmocked) THEME_BOOT_SCRIPT into the document head', () => {
  it('imports THEME_BOOT_SCRIPT from app/utils/theme and inlines it verbatim', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const configSource = await fs.readFile(path.resolve(process.cwd(), 'nuxt.config.ts'), 'utf-8');
    expect(configSource).toMatch(
      /import\s*\{\s*THEME_BOOT_SCRIPT\s*\}\s*from\s*'\.\/app\/utils\/theme'/
    );
    expect(configSource).toMatch(/innerHTML:\s*THEME_BOOT_SCRIPT/);
  });
});
