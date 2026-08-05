/**
 * Cross-handler state.
 *
 * `playMedia` already opens the YouTube/Spotify URL itself. The model
 * sometimes follows up with a redundant `openWebsite` for the same URL,
 * which would open a second tab — so `openWebsite` checks this timestamp
 * and skips media URLs opened in the last 15s.
 */
let lastMediaOpenTime = 0;

export function markMediaOpened() {
  lastMediaOpenTime = Date.now();
}

export function msSinceMediaOpened() {
  return Date.now() - lastMediaOpenTime;
}
