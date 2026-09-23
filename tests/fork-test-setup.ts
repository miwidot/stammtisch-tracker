import { vi } from 'vitest';
// Global default for fork-only flags (see app/utils/forkConfig.ts): mock every flag as if it
// were upstream's normal (enabled) behavior, so upstream's own unmodified test files keep
// exercising the code path they were written against. A dedicated fork test file that wants to
// assert this fork's actual (disabled) behavior overrides this with its own `vi.mock` call for
// the same module specifier -- the last registration for a given module wins within that test
// file's isolated module registry (see app/utils/__tests__/forkConfig.test.ts, which asserts this
// override mechanism directly rather than assuming it).
vi.mock('@/utils/forkConfig', () => ({ LIGHT_THEME_ENABLED: true }));
