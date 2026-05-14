/**
 * Hızlı Katılım sonrası sayfa geçişlerinde misafir socket referansının kaybolmaması için
 * useWorkspaceStore ile senkron tutulan modül düzeyi yedek (singleton).
 */

/** @type {import('socket.io-client').Socket | null} */
let liveGuestSocket = null;

export function assignGuestLiveSocket(socket) {
  liveGuestSocket = socket;
}

export function getGuestLiveSocket() {
  return liveGuestSocket;
}

export function clearGuestLiveSocket() {
  liveGuestSocket = null;
}
