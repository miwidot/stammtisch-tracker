// Fork: the one place that names this instance. Page titles, the title template, og:site_name,
// the JSON-LD publisher and the manifests all derive from it, so the tab never shows the
// upstream "TarkovTracker.org" name. Locale files (`seo.site_name`, `seo.routes.*.title`) repeat
// the literal because JSON cannot import; `tests/fork-branding.test.ts` keeps them in sync.
// Attribution to upstream lives in the footer and on /herkunft and is deliberately separate.
export const SITE_NAME = 'Tarkov Stammtisch';
export const SITE_TITLE_SEPARATOR = ' · ';
export const SITE_TITLE_SUFFIX = `${SITE_TITLE_SEPARATOR}${SITE_NAME}`;
