import { resolveLegalLinks } from '@/utils/legalLinks';
/** Stammtisch privacy/terms URLs (see app/utils/legalLinks.ts). */
export const useLegalLinks = () => resolveLegalLinks(useRuntimeConfig().public);
