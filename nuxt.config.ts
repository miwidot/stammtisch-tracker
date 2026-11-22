// https://nuxt.com/docs/api/configuration/nuxt-config
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveTrustProxySetting } from './app/utils/apiProtectionConfig';
import { resolveBuildCommit } from './app/utils/buildCommit';
import { ENTRY_RECOVERY_SCRIPT } from './app/utils/entryRecoveryScript';
import { robotsTxtAllowingIndexing } from './app/utils/indexingPolicy';
import {
  DEFAULT_LEGAL_PRIVACY_URL,
  DEFAULT_LEGAL_TERMS_URL,
  resolveLegalUrl,
} from './app/utils/legalLinks';
import { SUPPORTED_LOCALES } from './app/utils/locales';
import {
  assertCloudflarePagesOutput,
  buildContentSecurityPolicyRouteRules,
  resolveNitroPreset,
} from './app/utils/nuxtSecurityConfig';
import { assertPrerenderedDocuments } from './app/utils/prerenderOutput';
import { CLIENT_DOCUMENT_ROUTES, PUBLIC_SEO_ROUTES } from './app/utils/routeSeo';
import {
  resolveCanonicalSiteUrl,
  resolveClientLogSinkUrl,
  resolveProgressDiagnosticSinkUrl,
  resolvePublicAppUrl,
  resolveSupabaseRuntimeConfig,
  resolveTrackerHandoffUrl,
  TARKOV_IMAGE_DOMAINS,
} from './app/utils/runtimeConfig';
import {
  SHELL_DESKTOP_BREAKPOINT_PX,
  SHELL_DRAWER_COLLAPSED_WIDTH,
  SHELL_DRAWER_EXPANDED_WIDTH,
  SHELL_DRAWER_RAIL_STORAGE_KEY,
} from './app/utils/shellConfig';
// Fork: instance name for title template and OG/Twitter tags.
import { SITE_NAME } from './app/utils/siteBrand';
import { resolveDiscordInviteUrl } from './app/utils/supportLinks';
import { THEME_BOOT_SCRIPT } from './app/utils/theme';
import { TURNSTILE_TEST_SECRET_KEY, TURNSTILE_TEST_SITE_KEY } from './app/utils/turnstileKeys';
import { cleanCloudflareOutput, filterAutoImports } from './scripts/nuxt/buildHooks';
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const appDir = resolve(__dirname, 'app');
const nuxtRequire = createRequire(createRequire(import.meta.url).resolve('nuxt/package.json'));
const nitroPagesAdapter = resolve(
  nuxtRequire.resolve('nitropack/package.json'),
  '../dist/presets/cloudflare/runtime/cloudflare-pages'
);
const testsDir = resolve(__dirname, 'tests');
const packageJson = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'));
const appVersion = packageJson.version ?? 'dev';
const buildCommit = resolveBuildCommit(process.env);
const clientLogSinkUrl = resolveClientLogSinkUrl(process.env);
const progressDiagnosticSinkUrl = resolveProgressDiagnosticSinkUrl(process.env);
const isNonProduction = process.env.NODE_ENV !== 'production';
const CONFIGURED_NITRO_PRESET = process.env.NITRO_PRESET;
const NITRO_PRESET = resolveNitroPreset(CONFIGURED_NITRO_PRESET);
const PUBLIC_APP_URL = resolvePublicAppUrl(process.env);
// Meta/SEO surfaces (og:url, JSON-LD, sitemap site.url) must never leak a localhost/dev URL;
// fall back to the canonical production URL the same way the runtime canonical-link builder does.
const CANONICAL_SITE_URL = resolveCanonicalSiteUrl(PUBLIC_APP_URL);
// Fork: the supporter sales page does not exist here (no-supporter-sales.global.ts answers 404), so
// it must not be prerendered, or the build fails on that 404, nor appear in the sitemap.
// /privacy and /terms-of-service are redirected to the Stammtisch legal pages, so they are no
// prerendered documents either (a static file would be served before the redirect middleware).
const FORK_REMOVED_PUBLIC_ROUTES = new Set(['/supporter', '/privacy', '/terms-of-service']);
const FORK_PUBLIC_SEO_ROUTES = PUBLIC_SEO_ROUTES.filter(
  (route) => !FORK_REMOVED_PUBLIC_ROUTES.has(route)
);
const IS_PRODUCTION_BUILD = process.env.NODE_ENV === 'production';
// Fork: noindex everywhere unless NUXT_PUBLIC_ALLOW_INDEXING=true (app/utils/indexingPolicy.ts).
const ALLOW_INDEXING = process.env.NUXT_PUBLIC_ALLOW_INDEXING === 'true';
const GOOGLE_ANALYTICS_MEASUREMENT_ID = process.env.GA_MEASUREMENT_ID || '';
const MICROSOFT_CLARITY_PROJECT_ID = process.env.CLARITY_PROJECT_ID || '';
const {
  privateAnonKey: PRIVATE_SUPABASE_ANON_KEY,
  privateUrl: PRIVATE_SUPABASE_URL,
  publicAnonKey: PUBLIC_SUPABASE_ANON_KEY,
  publicUrl: PUBLIC_SUPABASE_URL,
} = resolveSupabaseRuntimeConfig(process.env);
const STRIPE_PRICE_KEYS = [
  'STRIPE_PRICE_SCAV_MONTHLY',
  'STRIPE_PRICE_SCAV_6MONTH',
  'STRIPE_PRICE_SCAV_YEARLY',
  'STRIPE_PRICE_TIMMY_MONTHLY',
  'STRIPE_PRICE_TIMMY_6MONTH',
  'STRIPE_PRICE_TIMMY_YEARLY',
  'STRIPE_PRICE_CHAD_MONTHLY',
  'STRIPE_PRICE_CHAD_6MONTH',
  'STRIPE_PRICE_CHAD_YEARLY',
] as const;
const IS_BUILD_COMMAND = process.argv.some((a) => a === 'build' || a === 'generate');
const IS_CF_PREVIEW = process.env.CF_PAGES === '1' && process.env.CF_PAGES_BRANCH !== 'main';
const IS_CI = process.env.CI === 'true';
// Skip Stripe env validation in CI: GitHub Actions builds run with placeholder/test keys
// and shouldn't fail the production build guard. Real production builds run on Cloudflare
// Pages (CF_PAGES=1), where IS_CI is false and the keys must be present.
// This fork disables the supporter sales page and the Stripe endpoints
// (app/middleware/no-supporter-sales.global.ts, app/server/middleware/no-stripe-endpoints.ts),
// so there is no payment surface for these keys to protect. Requiring them
// would only force every build through the CI escape hatch.
const SUPPORTER_SALES_DISABLED = true;
if (
  IS_PRODUCTION_BUILD &&
  IS_BUILD_COMMAND &&
  !IS_CF_PREVIEW &&
  !IS_CI &&
  !SUPPORTER_SALES_DISABLED
) {
  const missingKeys = ['STRIPE_SECRET_KEY', ...STRIPE_PRICE_KEYS].filter(
    (key) => !process.env[key]?.trim()
  );
  if (missingKeys.length > 0) {
    throw new Error(`[Config] Missing required Stripe env vars: ${missingKeys.join(', ')}`);
  }
}
// Sitekeys are public identifiers; the secret stays in the Pages project env. Production and
// preview builds require explicit configuration so a secret can never be deployed without the
// matching client widget. Local builds use Cloudflare test keys. Validate only actual build
// commands: pnpm install runs `nuxt prepare` as postinstall, which is not a deployable build.
const TURNSTILE_SITE_KEY = (
  process.env.NUXT_PUBLIC_TURNSTILE_SITE_KEY ??
  (!IS_PRODUCTION_BUILD ? TURNSTILE_TEST_SITE_KEY : '')
).trim();
const TURNSTILE_SECRET_KEY = (
  process.env.NUXT_TURNSTILE_SECRET_KEY ?? (IS_PRODUCTION_BUILD ? '' : TURNSTILE_TEST_SECRET_KEY)
).trim();
if (
  IS_PRODUCTION_BUILD &&
  IS_BUILD_COMMAND &&
  Boolean(TURNSTILE_SITE_KEY) !== Boolean(TURNSTILE_SECRET_KEY)
) {
  throw new Error(
    '[Config] NUXT_PUBLIC_TURNSTILE_SITE_KEY and NUXT_TURNSTILE_SECRET_KEY must be configured together'
  );
}
const TARKOV_ACCESS_SITE_KEY = (process.env.NUXT_PUBLIC_TARKOV_ACCESS_SITE_KEY ?? '').trim();
const cspRouteRules = buildContentSecurityPolicyRouteRules({
  clientLogSinkUrl,
  progressDiagnosticSinkUrl,
  supabaseUrl: PUBLIC_SUPABASE_URL,
  turnstileSiteKey: TURNSTILE_SITE_KEY || TARKOV_ACCESS_SITE_KEY,
});
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  telemetry: false,
  ssr: true,
  experimental: {
    payloadExtraction: false,
  },
  srcDir: 'app',
  ignore: ['**/__tests__/**', '**/*.test.*', '**/*.spec.*'],
  runtimeConfig: {
    // Server-only (private) runtime config
    supabaseUrl: PRIVATE_SUPABASE_URL,
    supabaseServiceKey: process.env.NUXT_SUPABASE_SERVICE_KEY || '',
    // Fork: shared secret for the main site's account deletion call (>= 32 chars, see FORK.md)
    forkAccountDeleteSecret: process.env.NUXT_FORK_ACCOUNT_DELETE_SECRET || '',
    supabaseAnonKey: PRIVATE_SUPABASE_ANON_KEY,
    githubToken: process.env.NUXT_GITHUB_TOKEN?.trim() || '',
    githubContributorsExclude:
      process.env.NUXT_GITHUB_CONTRIBUTORS_EXCLUDE ||
      'claude,claude[bot],semantic-release-bot,semantic-release[bot]',
    githubContributorsCacheTtlMs:
      Number(process.env.NUXT_GITHUB_CONTRIBUTORS_CACHE_TTL_MS || '1800000') || 1800000,
    githubTimeoutMs: Number(process.env.NUXT_GITHUB_TIMEOUT_MS || '8000') || 8000,
    tarkovJsonBaseUrl: process.env.NUXT_TARKOV_JSON_BASE_URL || '',
    logSinkUrl: process.env.NUXT_LOG_SINK_URL || '',
    // Fork: /api/twitch/live answers 404 unless this is exactly 'true' (promoted stream is off).
    twitchLiveEndpointEnabled: process.env.NUXT_TWITCH_LIVE_ENDPOINT_ENABLED === 'true',
    twitchClientId: process.env.NUXT_TWITCH_CLIENT_ID || 'kimne78kx3ncx6brgo4mv6wki5h1ko',
    publicCacheBypassEnabled: process.env.NUXT_CACHE_BYPASS_ENABLED === 'true',
    teamMembersCacheTtlMs: Number(process.env.NUXT_TEAM_MEMBERS_CACHE_TTL_MS || '5000') || 5000,
    teamMembersRateLimitPerMinute:
      Number(process.env.NUXT_TEAM_MEMBERS_RATE_LIMIT_PER_MINUTE || '120') || 120,
    stripeSecretKey: (process.env.STRIPE_SECRET_KEY ?? '').trim(),
    stripePriceScavMonthly: (process.env.STRIPE_PRICE_SCAV_MONTHLY ?? '').trim(),
    stripePriceScav6month: (process.env.STRIPE_PRICE_SCAV_6MONTH ?? '').trim(),
    stripePriceScavYearly: (process.env.STRIPE_PRICE_SCAV_YEARLY ?? '').trim(),
    stripePriceTimmyMonthly: (process.env.STRIPE_PRICE_TIMMY_MONTHLY ?? '').trim(),
    stripePriceTimmy6month: (process.env.STRIPE_PRICE_TIMMY_6MONTH ?? '').trim(),
    stripePriceTimmyYearly: (process.env.STRIPE_PRICE_TIMMY_YEARLY ?? '').trim(),
    stripePriceChadMonthly: (process.env.STRIPE_PRICE_CHAD_MONTHLY ?? '').trim(),
    stripePriceChad6month: (process.env.STRIPE_PRICE_CHAD_6MONTH ?? '').trim(),
    stripePriceChadYearly: (process.env.STRIPE_PRICE_CHAD_YEARLY ?? '').trim(),
    accountIpHashSecret: (process.env.NUXT_ACCOUNT_IP_HASH_SECRET ?? '').trim(),
    sharedProfileCacheTtlMs: Number(process.env.NUXT_SHARED_PROFILE_CACHE_TTL_MS || '5000') || 5000,
    sharedProfileRateLimitPerMinute:
      Number(process.env.NUXT_SHARED_PROFILE_RATE_LIMIT_PER_MINUTE || '120') || 120,
    tarkovDevProfileCacheTtlMs:
      Number(process.env.NUXT_TARKOV_DEV_PROFILE_CACHE_TTL_MS || '900000') || 900000,
    tarkovDevProfileRateLimitPerMinute:
      Number(process.env.NUXT_TARKOV_DEV_PROFILE_RATE_LIMIT_PER_MINUTE || '5') || 5,
    tarkovDevProfileRateLimitPerHour:
      Number(process.env.NUXT_TARKOV_DEV_PROFILE_RATE_LIMIT_PER_HOUR || '20') || 20,
    // 0 disables the freshness gate, so the raw value must survive without a truthiness fallback;
    // an empty-string env var must not silently disable the gate either.
    tarkovDevProfileMaxUpdatedAgeDays: Number(
      process.env.NUXT_TARKOV_DEV_PROFILE_MAX_UPDATED_AGE_DAYS?.trim() || '7'
    ),
    // Tarkov data browser-clearance handoff (app/server/utils/tarkovAccessConfig.ts):
    // disabled by default. The secret and the exact hostname allowlist are per-deployment
    // settings — keep them in the Pages env/dashboard, never commit them. See
    // .env.example and wrangler.toml for the commented deployment wiring.
    tarkovAccessSecretKey: (process.env.NUXT_TARKOV_ACCESS_SECRET_KEY ?? '').trim(),
    tarkovAccessExpectedHostnames: (process.env.NUXT_TARKOV_ACCESS_EXPECTED_HOSTNAMES ?? '').trim(),
    tarkovVerifyRateLimitPerMinute:
      Number(process.env.NUXT_TARKOV_VERIFY_RATE_LIMIT_PER_MINUTE || '10') || 10,
    turnstileSecretKey: TURNSTILE_SECRET_KEY,
    // API protection configuration (server-only)
    apiProtection: {
      // Comma-separated list of allowed hosts (e.g., "tarkovtracker.org,www.tarkovtracker.org")
      allowedHosts: process.env.API_ALLOWED_HOSTS || '',
      // Comma-separated list of internal/trusted IP ranges (CIDR notation or single IPs)
      // e.g., "10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,127.0.0.1"
      trustedIpRanges: process.env.API_TRUSTED_IP_RANGES || '',
      // Whether to require authentication for protected API routes
      requireAuth: process.env.API_REQUIRE_AUTH !== 'false', // defaults to true
      // Routes that are exempt from auth requirement (comma-separated, supports wildcards)
      // e.g., "/api/tarkov/*" for public data endpoints
      publicRoutes:
        process.env.API_PUBLIC_ROUTES?.trim() ||
        '/api/tarkov/*,/api/tarkov-dev/profile,/api/changelog,/api/contributors,/api/logs/client,/api/logs/progress,/api/security/tarkov-verify,/api/profile/*,/api/streamer/*,/api/twitch/*',
      // Whether to trust proxy headers (X-Forwarded-For, etc.)
      // ONLY enable this if the server is behind a trusted proxy like Cloudflare
      trustProxy: resolveTrustProxySetting({
        API_TRUST_PROXY: process.env.API_TRUST_PROXY,
        NITRO_PRESET,
      }),
    },
    public: {
      NODE_ENV: process.env.NODE_ENV || 'production',
      logLevel: process.env.NUXT_PUBLIC_LOG_LEVEL || '',
      appUrl: PUBLIC_APP_URL,
      appVersion,
      buildCommit,
      googleAnalyticsMeasurementId: IS_PRODUCTION_BUILD ? GOOGLE_ANALYTICS_MEASUREMENT_ID : '',
      microsoftClarityProjectId: IS_PRODUCTION_BUILD ? MICROSOFT_CLARITY_PROJECT_ID : '',
      supabaseAnonKey: PUBLIC_SUPABASE_ANON_KEY,
      supabaseUrl: PUBLIC_SUPABASE_URL,
      clientLogSinkUrl,
      progressDiagnosticSinkUrl,
      turnstileSiteKey: TURNSTILE_SITE_KEY,
      // Tarkov data browser-clearance gate: disabled default. Never flip the flag without
      // the dedicated sitekey/secret/exact-hostname allowlist. The verification endpoint
      // fails closed on incomplete configuration; the probe only tests edge passage.
      tarkovAccessEnabled: process.env.NUXT_PUBLIC_TARKOV_ACCESS_ENABLED === 'true',
      tarkovAccessSiteKey: TARKOV_ACCESS_SITE_KEY,
      tarkovDevImportCooldownMinutes: Number(
        process.env.NUXT_PUBLIC_TARKOV_DEV_IMPORT_COOLDOWN_MINUTES?.trim() || '60'
      ),
      adminWatchTimeoutMs: Number(process.env.ADMIN_WATCH_TIMEOUT_MS || '5000') || 5000,
      // Fork: overrides the 12 h client cache TTL (ms); 0 = always revalidate. Empty keeps the
      // upstream TTL. Runtime value: set NUXT_PUBLIC_TARKOV_DATA_CACHE_TTL_MS, no rebuild (FORK.md 3.16).
      tarkovDataCacheTtlMs: '',
      // Fork: off by default. true brings back the server-side api.github.com calls behind
      // /api/changelog and /api/contributors (see FORK.md); anything else keeps them silent.
      upstreamGithubEnabled: process.env.UPSTREAM_GITHUB_ENABLED === 'true',
      githubOwner: process.env.GITHUB_OWNER || 'tarkovtracker-org',
      githubRepo: process.env.GITHUB_REPO || 'TarkovTracker',
      trackerHandoffUrl: resolveTrackerHandoffUrl(process.env),
      allowIndexing: ALLOW_INDEXING,
      // Fork: Discord invite for report/support links (falls back to the Stammtisch default)
      discordInviteUrl: resolveDiscordInviteUrl(process.env.NUXT_PUBLIC_DISCORD_INVITE_URL),
      // Fork: where users delete their account (main site; the tracker account goes with it)
      accountDeletionUrl:
        process.env.NUXT_PUBLIC_ACCOUNT_DELETION_URL?.trim() ||
        'https://tarkov-stammtisch.de/profile/settings',
      // Fork: upstream's /privacy and /terms-of-service redirect here (main site legal pages)
      legalPrivacyUrl: resolveLegalUrl(
        process.env.NUXT_PUBLIC_LEGAL_PRIVACY_URL,
        DEFAULT_LEGAL_PRIVACY_URL
      ),
      legalTermsUrl: resolveLegalUrl(
        process.env.NUXT_PUBLIC_LEGAL_TERMS_URL,
        DEFAULT_LEGAL_TERMS_URL
      ),
      promotedTwitch: {
        channel: process.env.NUXT_PUBLIC_PROMOTED_TWITCH_CHANNEL || 'honeyxxo',
        displayName: process.env.NUXT_PUBLIC_PROMOTED_TWITCH_DISPLAY_NAME || 'honeyxxo',
        enabled: process.env.NUXT_PUBLIC_PROMOTED_TWITCH_ENABLED === 'true',
      },
    },
  },
  devtools: {
    enabled: process.env.NODE_ENV === 'development',
    timeline: {
      enabled: true,
    },
  },
  serverDir: resolve(__dirname, 'app/server'),
  nitro: {
    preset: NITRO_PRESET,
    cloudflare: {
      pages: {
        defaultRoutes: false,
        routes: {
          include: ['/api/*', '/overlay/*', '/profile/*', '/@*'],
          exclude: [],
        },
      },
    },
    prerender: {
      routes: [...FORK_PUBLIC_SEO_ROUTES, ...CLIENT_DOCUMENT_ROUTES, '/200.html', '/404.html'],
      crawlLinks: false,
      autoSubfolderIndex: false,
      failOnError: true,
    },
    hooks: {
      async compiled(nitro) {
        cleanCloudflareOutput(nitro.options.preset, nitro.options.output.serverDir);
        // Fork: public/robots.txt disallows everything; with indexing on, ship upstream's rules.
        if (ALLOW_INDEXING) {
          writeFileSync(
            resolve(nitro.options.output.publicDir, 'robots.txt'),
            robotsTxtAllowingIndexing(CANONICAL_SITE_URL)
          );
        }
      },
    },
  },
  routeRules: {
    '/neededitems': { redirect: { to: '/needed-items', statusCode: 301 } },
    '/streamer-tools': { redirect: { to: '/settings#streamer-tools', statusCode: 301 } },
    // Most application routes stay client-rendered; public documents opt into SSR.
    '/**': {
      ...cspRouteRules['/**'],
      // Fork: no search indexing, also for static files such as the prerendered `/`.
      ...(ALLOW_INDEXING
        ? {}
        : { headers: { ...cspRouteRules['/**']?.headers, 'X-Robots-Tag': 'noindex, nofollow' } }),
      ssr: false,
    },
    ...Object.fromEntries(
      FORK_PUBLIC_SEO_ROUTES.map((route) => [route, { ssr: true, prerender: true }])
    ),
    ...Object.fromEntries(
      CLIENT_DOCUMENT_ROUTES.map((route) => [route, { ssr: false, prerender: true }])
    ),
    '/200.html': { ssr: false, prerender: true },
    '/404.html': { ssr: false, prerender: true },
    // Explicit long-term caching for build assets
    '/_nuxt/**': {
      headers: { 'cache-control': 'public,max-age=31536000,immutable' },
    },
    '/_fonts/**': {
      headers: { 'cache-control': 'public,max-age=31536000,immutable' },
    },
    '/overlay/kappa/**': cspRouteRules['/overlay/kappa/**'],
  },
  app: {
    baseURL: '/',
    buildAssetsDir: '/_nuxt/',
    head: {
      titleTemplate: `%s | ${SITE_NAME}`,
      title: 'Quest-, Hideout- und Item-Tracker',
      link: [
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
        { rel: 'icon', type: 'image/png', sizes: '48x48', href: '/favicon-48x48.png' },
        { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/favicon-192x192.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/manifest.json' },
      ],
      style: [
        {
          textContent: [
            `:root{--shell-w:${SHELL_DRAWER_EXPANDED_WIDTH};--shell-bar-h:3.5rem}`,
            '@media(width >= 640px){:root{--shell-bar-h:4rem}}',
            'body{background:var(--color-surface-950,hsl(90 10% 3.9%))}',
            // Light theme pre-hydration: match the warm-paper surface values from
            // tailwind.css so the skeleton never flashes dark for light-theme users.
            `[data-theme='light']{`,
            '--color-surface-950:hsl(40 24% 92%);',
            '--color-surface-900:hsl(38 18% 87%);',
            '--color-surface-700:hsl(38 16% 82%)',
            '}',
            '#__nuxt:empty::before{',
            'content:"";',
            'display:block;',
            'position:fixed;',
            'inset:0;',
            'width:var(--shell-w);',
            'background:var(--color-surface-900,hsl(80 9.7% 6.1%));',
            'border-right:1px solid var(--color-surface-700,hsl(82.5 11.1% 14.1%));',
            'z-index:50',
            '}',
            '#__nuxt:empty::after{',
            'content:"";',
            'display:block;',
            'position:fixed;',
            'top:0;',
            'left:var(--shell-w);',
            'right:0;',
            'height:var(--shell-bar-h);',
            'background:var(--color-surface-900,hsl(80 9.7% 6.1%));',
            'border-bottom:1px solid var(--color-surface-700,hsl(82.5 11.1% 14.1%));',
            'z-index:40',
            '}',
            `@media(width < ${SHELL_DESKTOP_BREAKPOINT_PX}px){`,
            `:root{--shell-w:${SHELL_DRAWER_COLLAPSED_WIDTH}}`,
            '}',
          ].join(''),
        },
      ],
      script: [
        {
          // Applies data-theme + color-scheme before first paint (issue #102).
          innerHTML: THEME_BOOT_SCRIPT,
        },
        {
          innerHTML: ENTRY_RECOVERY_SCRIPT,
        },
        {
          innerHTML: [
            'try{',
            `if(window.localStorage.getItem(${JSON.stringify(SHELL_DRAWER_RAIL_STORAGE_KEY)})==="true"`,
            `&&window.matchMedia("(min-width:${SHELL_DESKTOP_BREAKPOINT_PX}px)").matches)`,
            `{document.documentElement.style.setProperty("--shell-w",${JSON.stringify(SHELL_DRAWER_COLLAPSED_WIDTH)})}`,
            '}catch(e){}',
          ].join(''),
        },
      ],
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'robots',
          content: ALLOW_INDEXING ? 'index, follow, max-image-preview:large' : 'noindex, nofollow',
        },
        {
          name: 'description',
          content:
            'Verfolge deinen Fortschritt bei Escape from Tarkov Aufgaben, Storyline, Hideout-Ausbau und benötigten Gegenständen. Plane Raids, teile deinen Fortschritt mit deinem Team und bleib startklar für Wipes.',
        },
        {
          name: 'keywords',
          content:
            'tarkov quest-tracker, escape from tarkov aufgaben, eft hideout tracker, eft benötigte gegenstände, tarkov stammtisch',
        },
        { name: 'theme-color', content: '#c8a882' },
        // OpenGraph tags. og:image/twitter:image are deliberately not set here: upstream's
        // per-route SEO (useRouteSeo) owns images, and a static one would shadow guide share images.
        { property: 'og:site_name', content: SITE_NAME },
        { property: 'og:type', content: 'website' },
        { property: 'og:title', content: `Quest-Tracker | ${SITE_NAME}` },
        {
          property: 'og:description',
          content:
            'Der deutsche Quest-Tracker der Tarkov-Stammtisch-Community - verfolge deinen Fortschritt bei Aufgaben, Hideout-Ausbau und benötigten Gegenständen.',
        },
        { property: 'og:url', content: CANONICAL_SITE_URL },
        { property: 'og:locale', content: 'de_DE' },
        // Twitter Card tags
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: `Quest-Tracker | ${SITE_NAME}` },
        {
          name: 'twitter:description',
          content:
            'Der deutsche Quest-Tracker der Tarkov-Stammtisch-Community - verfolge deinen Fortschritt bei Aufgaben, Hideout-Ausbau und benötigten Gegenständen.',
        },
        { name: 'apple-mobile-web-app-title', content: SITE_NAME },
      ],
    },
  },
  css: ['~/assets/css/tailwind.css'],
  alias: {
    'nitropack/presets/cloudflare/runtime/cloudflare-pages': nitroPagesAdapter,
    '@': appDir,
    '#tests': testsDir,
    '~': appDir,
  },
  modules: [
    isNonProduction ? '@nuxt/eslint' : undefined,
    isNonProduction ? '@nuxt/test-utils/module' : undefined,
    '@pinia/nuxt',
    '@nuxt/ui',
    '@nuxt/image',
    '@nuxtjs/i18n',
    process.env.NODE_ENV === 'test' ? undefined : '@nuxtjs/sitemap',
    // Main Actions builds report with short-lived GitHub identity, never an upload token.
    // Anonymous previews and local builds leave this flag empty.
    process.env.CODECOV_USE_OIDC === 'true'
      ? ([
          '@codecov/nuxt-plugin',
          {
            enableBundleAnalysis: true,
            bundleName: 'tarkovtracker',
            gitService: 'github',
            oidc: { useGitHubOIDC: true },
            uploadOverrides: {
              slug: 'tarkovtracker-org/TarkovTracker',
            },
            telemetry: false,
          },
        ] as [string, Record<string, unknown>])
      : undefined,
  ].filter(Boolean) as (string | [string, Record<string, unknown>])[],
  site: {
    url: CANONICAL_SITE_URL,
    name: 'Tarkov Stammtisch',
  },
  sitemap: {
    // Fork: no sitemap unless indexing is switched on (app/utils/indexingPolicy.ts).
    enabled: ALLOW_INDEXING,
    zeroRuntime: true,
    xslColumns: [
      { label: 'URL', width: '65%' },
      { label: 'Last Modified', select: 'sitemap:lastmod', width: '25%' },
    ],
    excludeAppSources: true,
    autoLastmod: false,
    discoverImages: false,
    urls: FORK_PUBLIC_SEO_ROUTES,
  },
  i18n: {
    bundle: {
      compositionOnly: true,
      runtimeOnly: true,
    },
    compilation: {
      strictMessage: false,
      escapeHtml: true,
    },
    strategy: 'no_prefix',
    defaultLocale: 'de',
    detectBrowserLanguage: false,
    restructureDir: 'app',
    langDir: 'locales',
    locales: SUPPORTED_LOCALES.map((code) =>
      code === 'de'
        ? { code, files: ['de.json', 'de.overrides.json'] }
        : { code, file: `${code}.json` }
    ),
    vueI18n: 'i18n.config.ts',
  },
  hooks: {
    // Tracker modules keep their client state; route entrypoints render public summaries.
    'pages:extend': (pages) => {
      const wrappers: Record<string, string> = {
        '/': 'index',
        '/tasks': 'tasks',
        '/hideout': 'hideout',
        '/needed-items': 'needed-items',
        '/kappa': 'kappa',
        '/storyline': 'storyline',
        '/changelog': 'changelog',
      };
      for (const page of pages) {
        const wrapper = wrappers[page.path];
        if (wrapper) page.file = resolve(appDir, 'features/seo-pages', `${wrapper}.vue`);
      }
      // Task views are routes of the same tracker module (app/utils/taskRouteView.ts).
      for (const view of ['traders', 'maps', 'graph']) {
        pages.push({
          name: `tasks-${view}`,
          path: `/tasks/${view}`,
          file: resolve(appDir, 'features/seo-pages', 'tasks.vue'),
        });
      }
    },
    'nitro:init': (nitro) => {
      if (!String(nitro.options.preset || '').includes('cloudflare')) {
        return;
      }
      // Change only the resolved Pages entry; prerender/dev must keep their own adapters.
      if (nitro.options.preset === 'cloudflare-pages') {
        nitro.options.entry = resolve(appDir, 'server/pages-entry.ts');
      }
      nitro.hooks.hook('compiled', () => {
        writeFileSync(
          resolve(nitro.options.output.dir, '_routes.json'),
          JSON.stringify(
            { version: 1, include: ['/api/*', '/overlay/*', '/profile/*', '/@*'], exclude: [] },
            null,
            2
          )
        );
        assertCloudflarePagesOutput(nitro.options.output.dir, [
          '/api/*',
          '/overlay/*',
          '/profile/*',
          '/@*',
        ]);
        assertPrerenderedDocuments(nitro.options.output.publicDir);
      });
    },
    'imports:extend': filterAutoImports,
  },
  image: {
    // Fork: the image proxy only fetches game art from tarkov.dev; local files need no entry.
    domains: [...TARKOV_IMAGE_DOMAINS],
  },
  icon: {
    // Fork: never ask api.iconify.design at runtime. Icons come from the client bundle, then from
    // our own /api/_nuxt_icon endpoint (collections are bundled into the server).
    fallbackToApi: false,
    // 'auto' would pick 'remote' for edge presets and make the server fetch icon sets from
    // cdn.jsdelivr.net at runtime. The fork always runs node-server, so bundle them locally.
    serverBundle: 'local',
    clientBundle: {
      scan: {
        globInclude: ['**/*.{vue,jsx,tsx,md,mdc,mdx,yml,yaml}', 'app/**/*.ts'],
      },
    },
  },
  // Pin Nuxt UI to its dark alias block regardless of OS preference. The app's
  // light theme is driven by [data-theme='light'] flipping the shared surface
  // palette, which the Nuxt UI neutral aliases resolve through. Without this,
  // light-OS users would get mixed light/dark Nuxt UI internals (issue #102).
  colorMode: {
    preference: 'dark',
    fallback: 'dark',
  },
  ui: {
    theme: {
      colors: [
        'primary',
        'secondary',
        'neutral',
        'brand',
        'accent',
        'pvp',
        'pve',
        'info',
        'success',
        'warning',
        'error',
        'kappa',
        'lightkeeper',
      ],
    },
  },
  // Nuxt default; lets Fallow model auto-imports and report unused utils/composables.
  imports: {},
  components: [
    {
      path: '~/components',
      pathPrefix: false,
      extensions: ['vue'],
    },
    {
      path: '~/features',
      pathPrefix: false,
      extensions: ['vue'],
    },
    {
      path: '~/shell',
      pathPrefix: false,
      extensions: ['vue'],
    },
  ],
  typescript: {
    tsConfig: {
      compilerOptions: {
        paths: {
          '@/*': ['./app/*'],
          '#tests/*': ['./tests/*'],
          '#tests': ['./tests'],
          '~/*': ['./app/*'],
        },
      },
    },
  },
  postcss: {
    plugins: {
      '@tailwindcss/postcss': {},
    },
  },
  vite: {
    plugins: [
      {
        enforce: 'pre',
        name: 'nuxt-ui-use-resizable-options-shim',
        transform(code, id) {
          if (!id.includes('@nuxt/ui/dist/runtime/composables/useResizable.js')) {
            return;
          }
          if (code.includes('export const options')) {
            return;
          }
          return `${code}\nexport const options = {};\n`;
        },
      },
    ],
    base: '/',
    optimizeDeps: {
      exclude: ['better-sqlite3'],
      include: [
        '@supabase/supabase-js',
        '@vueuse/core',
        'fflate',
        'leaflet',
        'pinia-plugin-persistedstate',
      ],
    },
    vue: {
      // Forwarded to @vitejs/plugin-vue
      template: {
        compilerOptions: {
          isCustomElement: (tag: string) => tag === 'suspense',
        },
      },
    },
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              { name: 'vendor-leaflet', test: /node_modules[\\/]leaflet/ },
              { name: 'vendor-supabase', test: /node_modules[\\/]@supabase/ },
              {
                name: 'vendor-core',
                test: /node_modules[\\/](vue|pinia|ufo|ofetch|defu|h3)/,
              },
            ],
          },
        },
      },
    },
  },
});
