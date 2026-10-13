const DISMISS_KEY = 'eba-pwa-install-dismissed';
// On ne re-propose pas l'installation avant ce délai après un rejet.
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours
export const SHOW_DELAY_MS = 4000;

export type Platform = 'android' | 'ios' | 'desktop' | 'unknown';

// Événement non standard exposé par Chromium pour l'installation des PWA.
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  const isIpadOS =
    navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  if (/iphone|ipad|ipod/.test(ua) || isIpadOS) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'desktop';
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

export function wasRecentlyDismissed(): boolean {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    return Number.isFinite(ts) && Date.now() - ts < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

export function markDismissed(): void {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* noop */
  }
}
