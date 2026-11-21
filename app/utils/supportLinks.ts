/**
 * Fork: user-facing "report a problem / get help" links go to the Stammtisch Discord, not to
 * upstream's GitHub issues. The invite is configurable (`NUXT_PUBLIC_DISCORD_INVITE_URL`, the
 * counterpart of the main site's NEXT_PUBLIC_DISCORD_INVITE) and falls back to the same default.
 * Attribution, licence and source links to upstream are NOT touched by this.
 */
export const DEFAULT_DISCORD_INVITE_URL = 'https://discord.gg/tarkovstammtisch';
const INVITE_HOSTS = new Set(['discord.gg', 'www.discord.gg', 'discord.com', 'www.discord.com']);
/** Accepts only https Discord invite URLs; anything else (javascript:, other hosts) falls back. */
export const resolveDiscordInviteUrl = (value: unknown): string => {
  if (typeof value !== 'string') return DEFAULT_DISCORD_INVITE_URL;
  try {
    const url = new URL(value.trim());
    const isInvitePath = url.hostname.endsWith('discord.com')
      ? url.pathname.startsWith('/invite/')
      : url.pathname.length > 1;
    if (url.protocol === 'https:' && INVITE_HOSTS.has(url.hostname) && isInvitePath) {
      return url.toString();
    }
  } catch {
    // Not a URL: use the default.
  }
  return DEFAULT_DISCORD_INVITE_URL;
};
