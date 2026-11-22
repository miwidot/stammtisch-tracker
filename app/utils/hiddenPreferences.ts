import { STREAMER_MODE_PREFERENCE_ENABLED } from '@/utils/forkConfig';
/**
 * Fork: the streamer-mode preference has no UI (see `STREAMER_MODE_PREFERENCE_ENABLED`), so a
 * value stored before it was hidden must not keep acting invisibly. Clears a stored `true` and
 * reports whether it did, so the caller can push the cleared value to the server (the public
 * profile endpoint reads `streamer_mode` from the database).
 */
export const clearHiddenStreamerMode = (store: {
  streamerMode?: boolean;
  setStreamerMode: (mode: boolean) => void;
}): boolean => {
  if (STREAMER_MODE_PREFERENCE_ENABLED || store.streamerMode !== true) return false;
  store.setStreamerMode(false);
  return true;
};
