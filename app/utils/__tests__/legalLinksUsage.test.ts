import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');
describe('upstream legal pages are not reachable any more', () => {
  it('keeps the upstream page files (merge cost) but guards them with both redirects', () => {
    // The pages still carry upstream's text; they must never render. The server middleware
    // answers direct requests, the global route middleware answers client navigation.
    expect(read('app/server/middleware/03.fork-legal-redirect.ts')).toContain('matchLegalRoute');
    expect(read('app/middleware/legal-redirect.global.ts')).toContain('matchLegalRoute');
  });
  it.each([
    'app/pages/login.vue',
    'app/components/analytics/AnalyticsConsentBanner.vue',
    'app/shell/AppFooter.vue',
  ])('%s does not link to the internal upstream legal routes', (file) => {
    expect(read(file)).not.toMatch(/['"`]\/(privacy|terms-of-service)\b/);
  });
  it('does not prerender the redirected routes (a static file would win over the redirect)', () => {
    const config = read('nuxt.config.ts');
    expect(config).toMatch(
      /FORK_REMOVED_PUBLIC_ROUTES = new Set\([^)]*'\/privacy'[^)]*'\/terms-of-service'/
    );
  });
});
