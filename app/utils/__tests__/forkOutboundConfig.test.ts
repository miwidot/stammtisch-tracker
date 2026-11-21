import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TARKOV_IMAGE_DOMAINS } from '@/utils/runtimeConfig';
// Fork deviation guard (see FORK.md, "Ausgehende Verbindungen"): these defaults keep the instance
// from talking to hosts we never use. nuxt.config.ts cannot be imported without the Nuxt build
// context, so the declarations are read from the file; the behavior itself is covered by the
// route, component and middleware tests next to the code.
const config = readFileSync('nuxt.config.ts', 'utf-8');
describe('nuxt.config.ts outbound defaults', () => {
  it('never lets the browser fall back to api.iconify.design', () => {
    expect(config).toMatch(/icon:\s*\{[^}]*?fallbackToApi:\s*false/s);
    expect(config).not.toMatch(/fallbackToApi:\s*(true|'client-only'|'server-only')/);
  });
  it('bundles icon sets into the server instead of fetching them from a CDN', () => {
    expect(config).toMatch(/icon:\s*\{[^}]*?serverBundle:\s*'local'/s);
  });
  it('lets the image proxy fetch from assets.tarkov.dev only', () => {
    expect(config).toMatch(/domains:\s*\[\.\.\.TARKOV_IMAGE_DOMAINS\]/);
    expect(config).not.toMatch(/GITHUB_IMAGE_DOMAINS|YOUTUBE_IMAGE_DOMAINS/);
    expect([...TARKOV_IMAGE_DOMAINS]).toEqual(['assets.tarkov.dev']);
  });
  it('keeps the upstream GitHub calls and the Twitch relay off unless a flag is exactly "true"', () => {
    expect(config).toMatch(
      /upstreamGithubEnabled:\s*process\.env\.UPSTREAM_GITHUB_ENABLED === 'true'/
    );
    expect(config).toMatch(
      /twitchLiveEndpointEnabled:\s*process\.env\.NUXT_TWITCH_LIVE_ENDPOINT_ENABLED === 'true'/
    );
  });
  it('does not feed analytics ids into the CSP any more', () => {
    expect(config).not.toMatch(/clarityInstrumentationKey|gaMeasurementId/);
  });
});
