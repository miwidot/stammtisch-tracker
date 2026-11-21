import { resolveDiscordInviteUrl } from '@/utils/supportLinks';
/** The Stammtisch Discord invite for report/support links (see app/utils/supportLinks.ts). */
export const useDiscordInvite = (): string =>
  resolveDiscordInviteUrl(useRuntimeConfig().public.discordInviteUrl);
