// @vitest-environment happy-dom
import { mockNuxtImport } from '@nuxt/test-utils/runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BASE_SITE_CONTEXT, createRouterStub } from '@/server/utils/__tests__/eventStubs';
import type { H3Event } from 'h3';
const { mockGetQuery, mockGetRouterParam, mockSetHeader, mockSetResponseHeader } = vi.hoisted(
  () => ({
    mockGetQuery: vi.fn(),
    mockGetRouterParam: vi.fn(),
    mockSetHeader: vi.fn(),
    mockSetResponseHeader: vi.fn(),
  })
);
vi.mock('h3', async () => {
  const actual = await vi.importActual('h3');
  return {
    ...actual,
    getQuery: mockGetQuery,
    getRouterParam: mockGetRouterParam,
    setHeader: mockSetHeader,
    setResponseHeader: mockSetResponseHeader,
  };
});
mockNuxtImport('useRouter', () => () => createRouterStub());
describe('Overlay Kappa Route', () => {
  let mockEvent: Partial<H3Event>;
  beforeEach(() => {
    vi.clearAllMocks();
    mockEvent = {
      context: {
        ...BASE_SITE_CONTEXT,
      },
    };
    mockGetRouterParam.mockImplementation((_, key: string) => {
      if (key === 'userId') return '11111111-1111-4111-8111-111111111111';
      if (key === 'mode') return 'pvp';
      return undefined;
    });
    mockGetQuery.mockReturnValue({});
  });
  it('renders html with default overlay config', async () => {
    const { default: handler } = await import('@/server/routes/overlay/kappa/[userId]/[mode].get');
    const html = await handler(mockEvent as H3Event);
    const cspHeader = mockSetResponseHeader.mock.calls.find(
      ([, name]) => name === 'Content-Security-Policy'
    )?.[2];
    expect(mockSetHeader).toHaveBeenCalledWith(
      mockEvent,
      'Content-Type',
      'text/html; charset=utf-8'
    );
    expect(mockSetResponseHeader).toHaveBeenCalledWith(
      mockEvent,
      'Cache-Control',
      'no-store, max-age=0'
    );
    expect(cspHeader).toContain("script-src 'unsafe-inline'");
    expect(cspHeader).toContain("frame-ancestors 'self'");
    // Fonts are self-hosted (see public/fonts/overlay/): no Google Fonts host may appear in the
    // CSP or the served HTML, or the streamer's IP leaks to Google on every OBS render.
    expect(cspHeader).not.toContain('fonts.googleapis.com');
    expect(cspHeader).not.toContain('fonts.gstatic.com');
    expect(cspHeader).toContain("font-src 'self'");
    expect(html).toContain('<title>TarkovTracker Stream Overlay</title>');
    expect(html).not.toContain('fonts.googleapis.com');
    expect(html).not.toContain('fonts.gstatic.com');
    expect(html).toContain('@font-face');
    expect(html).toContain("src: url('/fonts/overlay/rajdhani-400.woff2') format('woff2')");
    expect(html).toContain('"align":"bottom-left"');
    expect(html).toContain('"container":"canvas"');
    expect(html).toContain('"trackOpacity":20');
  });
  it('includes visibility recovery and BroadcastChannel listeners', async () => {
    const { default: handler } = await import('@/server/routes/overlay/kappa/[userId]/[mode].get');
    const html = await handler(mockEvent as H3Event);
    expect(html).toContain('visibilitychange');
    expect(html).toContain('refreshOnWake');
    expect(html).toContain('lastFetchTime');
    expect(html).toContain("addEventListener('online'");
    expect(html).toContain('BroadcastChannel');
    expect(html).toContain('tarkov-progress:');
    expect(html).toContain('"userId":"11111111-1111-4111-8111-111111111111"');
  });
  it('normalizes legacy alignment and applies custom styling query params', async () => {
    mockGetQuery.mockReturnValue({
      accent: 'custom',
      accentColor: '#123456',
      align: 'left',
      bg: 'custom',
      bgColor: '#111111',
      bgOpacity: '73',
      container: 'self-contained',
      font: 'inter',
      resolution: 'custom',
      scale: '140',
      showTitle: '0',
      trackColor: '#abcdef',
      trackOpacity: '55',
    });
    const { default: handler } = await import('@/server/routes/overlay/kappa/[userId]/[mode].get');
    const html = await handler(mockEvent as H3Event);
    expect(html).toContain('"align":"bottom-left"');
    expect(html).toContain('"container":"self-contained"');
    expect(html).toContain('"overlayScale":1.4');
    expect(html).toContain('"background":"custom"');
    expect(html).toContain('"trackOpacity":55');
    expect(html).toContain('"font":"inter"');
    expect(html).toContain("font-family: 'Inter'");
    expect(html).toContain("src: url('/fonts/overlay/inter-variable.woff2') format('woff2')");
    expect(html).not.toContain('fonts.googleapis.com');
  });
  it('never references a Google Fonts host for any selectable font, and inlines only the requested font', async () => {
    const fonts = ['inter', 'oswald', 'outfit', 'poppins', 'rajdhani', 'roboto-mono'];
    for (const font of fonts) {
      mockGetQuery.mockReturnValue({ font });
      const { default: handler } =
        await import('@/server/routes/overlay/kappa/[userId]/[mode].get');
      const html = await handler(mockEvent as H3Event);
      expect(html).not.toContain('fonts.googleapis.com');
      expect(html).not.toContain('fonts.gstatic.com');
      expect(html).not.toContain('google');
      const faceCount = html.match(/@font-face/g)?.length ?? 0;
      expect(faceCount).toBeGreaterThan(0);
    }
  });
  it('falls back to the default font for an unknown/invalid font query value', async () => {
    mockGetQuery.mockReturnValue({ font: '<script>alert(1)</script>' });
    const { default: handler } = await import('@/server/routes/overlay/kappa/[userId]/[mode].get');
    const html = await handler(mockEvent as H3Event);
    expect(html).toContain('"font":"rajdhani"');
    expect(html).toContain("font-family: 'Rajdhani'");
    expect(html).not.toContain('<script>alert(1)</script>');
  });
  it('every self-hosted font file referenced by an @font-face src actually exists under public/', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const fonts = ['inter', 'oswald', 'outfit', 'poppins', 'rajdhani', 'roboto-mono'];
    const referencedPaths = new Set<string>();
    for (const font of fonts) {
      mockGetQuery.mockReturnValue({ font });
      const { default: handler } =
        await import('@/server/routes/overlay/kappa/[userId]/[mode].get');
      const html = await handler(mockEvent as H3Event);
      for (const match of html.matchAll(/src: url\('(\/fonts\/overlay\/[^']+)'\)/g)) {
        referencedPaths.add(match[1] as string);
      }
    }
    expect(referencedPaths.size).toBeGreaterThan(0);
    for (const referencedPath of referencedPaths) {
      const absolutePath = path.resolve(process.cwd(), 'public', referencedPath.replace(/^\//, ''));
      await expect(fs.access(absolutePath)).resolves.toBeUndefined();
    }
  });
});
