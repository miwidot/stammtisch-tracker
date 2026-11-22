import { useMetadataStore } from '@/stores/useMetadata';
import { useTarkovStore } from '@/stores/useTarkov';
import { checkDataFingerprint, onDataFingerprintChange } from '@/utils/dataFingerprint';
import { logger } from '@/utils/logger';
/**
 * Fork (FORK.md 3.16): re-checks the server's game data fingerprint on tab focus. The check is
 * throttled inside `checkDataFingerprint`, so focus and visibility events may fire freely. A
 * changed fingerprint reloads the game data from the server (the cached entries are stale by now).
 */
export default defineNuxtPlugin({
  name: 'data-fingerprint',
  setup() {
    if (import.meta.env.MODE === 'test') return;
    const metadataStore = useMetadataStore();
    const tarkovStore = useTarkovStore();
    onDataFingerprintChange((next, previous) => {
      logger.info('[DataFingerprint] Game data changed, reloading', { previous, next });
      if (!metadataStore.hasInitialized) return;
      void metadataStore
        .initialize({ forceRefresh: true, gameMode: tarkovStore.getCurrentGameMode() })
        .catch((error) =>
          logger.error('[DataFingerprint] Reload after data change failed:', error)
        );
    });
    const check = () => {
      if (document.visibilityState === 'hidden') return;
      void checkDataFingerprint();
    };
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    void checkDataFingerprint();
  },
});
