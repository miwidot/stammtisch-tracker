import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Server routes do NOT get Nuxt's auto-imports for `app/utils/**`.
 * A symbol used there without an explicit import type-checks fine and passes
 * the unit suite (the test harness DOES auto-import), then throws
 * `ReferenceError: <symbol> is not defined` in the Nitro bundle at runtime.
 *
 * Regression guard for the live 500 on /api/profile/:userId/:mode, where
 * `hasMaterializedProgress` was used but never imported.
 */

const APP_DIR = join(process.cwd(), 'app');
const SERVER_DIR = join(APP_DIR, 'server');
const UTILS_DIR = join(APP_DIR, 'utils');

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return entry === '__tests__' ? [] : walk(full);
    return full.endsWith('.ts') && !full.endsWith('.d.ts') ? [full] : [];
  });

/** Exported const/function/class/type names of an `app/utils` module. */
const exportedNames = (file: string): string[] => {
  const source = readFileSync(file, 'utf8');
  return [...source.matchAll(/^export\s+(?:const|function|async function|class)\s+(\w+)/gm)].map(
    (m) => m[1]!
  );
};

const utilsModules = walk(UTILS_DIR).map((file) => ({
  file,
  specifier: `@/utils/${file.slice(UTILS_DIR.length + 1).replace(/\.ts$/, '')}`,
  names: exportedNames(file),
}));

const serverFiles = walk(SERVER_DIR);

describe('server files import every app/utils symbol they use', () => {
  it('finds files to check', () => {
    expect(serverFiles.length).toBeGreaterThan(0);
    expect(utilsModules.some((m) => m.names.length > 0)).toBe(true);
  });

  it.each(serverFiles.map((f) => [f.slice(APP_DIR.length + 1), f]))(
    '%s',
    (_label, file) => {
      const source = readFileSync(file as string, 'utf8');
      const missing: string[] = [];

      for (const mod of utilsModules) {
        for (const name of mod.names) {
          // Used as a call or reference, not as a property access or its own definition.
          const used = new RegExp(`(?<![.\\w])${name}\\s*\\(`).test(source);
          if (!used) continue;

          const imported = new RegExp(
            `import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*['"]${mod.specifier}['"]`,
            's'
          ).test(source);
          const definedLocally = new RegExp(
            `(?:const|function|async function|class)\\s+${name}\\b`
          ).test(source);

          if (!imported && !definedLocally) missing.push(`${name} (from ${mod.specifier})`);
        }
      }

      expect(missing, `used without an explicit import: ${missing.join(', ')}`).toEqual([]);
    }
  );
});
