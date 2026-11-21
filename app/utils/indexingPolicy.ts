/**
 * Fork: search engines are kept out of every page.
 *
 * One switch, `NUXT_PUBLIC_ALLOW_INDEXING=true`, restores upstream's behavior: indexable public
 * documents, canonical links, structured data, sitemap and upstream's robots.txt. Set it for the
 * BUILD and for the server (static headers, sitemap, robots.txt and the static robots meta are
 * decided at build time; the per-route head and the response header middleware at run time).
 *
 * Default (off): every response carries `X-Robots-Tag: noindex, nofollow`, every page a matching
 * robots meta tag, no canonical link (upstream's point at tarkovtracker.org), no `og:url` and no
 * JSON-LD from the per-route SEO, no sitemap, and robots.txt disallows everything.
 */
export const NOINDEX_DIRECTIVE = 'noindex, nofollow';
export const isIndexingAllowed = (value: unknown): boolean => value === true || value === 'true';
/** Upstream's robots.txt, for the case indexing is switched on. */
export const robotsTxtAllowingIndexing = (origin: string): string =>
  `User-Agent: *\nAllow: /\nDisallow: /api/\nDisallow: /overlay\n\nSitemap: ${origin.replace(/\/$/, '')}/sitemap.xml\n`;
interface HeadLike {
  link?: ReadonlyArray<{ rel?: string }>;
  meta?: ReadonlyArray<{ name?: string; property?: string; content?: string }>;
  script?: ReadonlyArray<{ type?: string }>;
}
/** Removes everything from a per-route SEO head that would invite indexing. */
export const applyIndexingPolicy = <T extends HeadLike>(head: T, allowIndexing: boolean): T => {
  if (allowIndexing) return head;
  return {
    ...head,
    link: (head.link ?? []).filter((link) => link.rel !== 'canonical' && link.rel !== 'alternate'),
    meta: (head.meta ?? [])
      .filter((tag) => tag.property !== 'og:url')
      .map((tag) => (tag.name === 'robots' ? { ...tag, content: NOINDEX_DIRECTIVE } : tag)),
    script: (head.script ?? []).filter((script) => script.type !== 'application/ld+json'),
  } as T;
};
