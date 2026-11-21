import { logger } from '@/utils/logger';
import { beginHandoff } from '@/utils/trackerHandoffState';
/**
 * Starts the Stammtisch login: stores a one-time nonce for this tab and navigates to the main
 * site's handoff URL with it as `?state=`. The handoff plugin refuses any returning token that
 * does not echo that nonce (login CSRF protection).
 */
export const useTrackerHandoff = () => {
  const { t } = useI18n({ useScope: 'global' });
  const toast = useToast();
  const trackerHandoffUrl = useRuntimeConfig().public.trackerHandoffUrl as string;
  const startHandoff = () => {
    try {
      window.location.href = beginHandoff(trackerHandoffUrl, window.location.origin);
    } catch (error) {
      logger.error('[Login] Could not start the handoff', error);
      toast.add({ title: t('page.login.error_title'), color: 'error' });
    }
  };
  return { startHandoff, trackerHandoffUrl };
};
