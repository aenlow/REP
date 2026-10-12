/**
 * Service-worker registration with a user-controlled update.
 * A new version waits until the user taps "Update" — never mid-workout by surprise.
 */

type Listener = (s: SwState) => void;
export interface SwState {
  supported: boolean;
  offlineReady: boolean;
  updateReady: boolean;
}

let state: SwState = { supported: false, offlineReady: false, updateReady: false };
let waiting: ServiceWorker | null = null;
const listeners = new Set<Listener>();

function set(patch: Partial<SwState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l(state));
}

export function subscribeSw(l: Listener): () => void {
  listeners.add(l);
  l(state);
  return () => listeners.delete(l);
}

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  set({ supported: true });
  window.addEventListener('load', async () => {
    try {
      // Relative URL + scope → works under /REP/ or any other subpath.
      const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
      if (reg.active) set({ offlineReady: true });
      if (reg.waiting && navigator.serviceWorker.controller) {
        waiting = reg.waiting;
        set({ updateReady: true });
      }
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        sw?.addEventListener('statechange', () => {
          if (sw.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              waiting = sw;
              set({ updateReady: true });
            } else {
              set({ offlineReady: true });
            }
          }
          if (sw.state === 'activated') set({ offlineReady: true });
        });
      });
      // Check for updates when the app comes back to the foreground.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => undefined);
      });
    } catch {
      set({ supported: false });
    }
  });
}

export function applyUpdate(): void {
  if (!waiting) return;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });
  waiting.postMessage({ type: 'SKIP_WAITING' });
}
