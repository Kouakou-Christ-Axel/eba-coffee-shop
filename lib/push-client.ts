// lib/push-client.ts
//
// Helpers navigateur pour les abonnements Web Push, partagés entre la cloche
// staff du dashboard (components/(dashboard)/push-notification-toggle.tsx) et
// le bouton client de la page de suivi (components/(public)/commande/…).
// Aucune dépendance serveur : utilisable uniquement dans des composants
// 'use client'.

/** Clé publique VAPID (exposée NEXT_PUBLIC_*). Absente = push désactivé. */
export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/** Le navigateur sait-il faire du push (et la clé VAPID est-elle fournie) ? */
export function isPushSupported(): boolean {
  return Boolean(
    VAPID_PUBLIC_KEY &&
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

// PushManager.subscribe attend la clé serveur en BufferSource, pas en base64url.
export function urlBase64ToUint8Array(base64Url: string): BufferSource {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from(rawData, (c) => c.charCodeAt(0)) as BufferSource;
}

/**
 * Enregistre le service worker (idempotent — il peut déjà l'être via
 * InstallPwa côté public) et renvoie le registration prêt.
 */
export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register('/sw.js');
  return navigator.serviceWorker.ready;
}

/**
 * Demande la permission puis renvoie l'abonnement push de cet appareil
 * (réutilise l'existant s'il y en a un). Renvoie `null` si la permission est
 * refusée.
 */
export async function ensurePushSubscription(): Promise<PushSubscription | null> {
  if (!VAPID_PUBLIC_KEY) return null;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const registration = await getServiceWorkerRegistration();
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
}
