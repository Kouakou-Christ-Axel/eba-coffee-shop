'use client';

// lib/hooks/use-restock-alert.ts
//
// Bouton « Préviens-moi quand c'est de retour » (carte publique) : abonne
// CET appareil au retour en stock d'un produit ou d'un goût épuisé
// (`/api/menu/alertes`, lib/restock-alerts.ts).
//
// Performance (CLAUDE.md, « Performance du site public ») : rien de lourd au
// chargement. L'état « alerte active » se lit dans le localStorage, sans
// requête ; le code push (`lib/push-client`) n'est importé qu'au clic, et la
// permission de notification n'est demandée qu'à ce moment-là.

import { useCallback, useEffect, useState } from 'react';
import { restockTargetKey, type RestockAlertTarget } from '@/lib/schemas/push';

const STORAGE_KEY = 'eba-restock-alerts';

function readKeys(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed)
      ? parsed.filter((k): k is string => typeof k === 'string')
      : [];
  } catch {
    return [];
  }
}

function writeKeys(keys: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  } catch {
    // Stockage indisponible (navigation privée) : l'alerte vit côté serveur.
  }
}

/** Test synchrone et léger : pas besoin de charger `lib/push-client`. */
function pushLooksSupported(): boolean {
  return (
    Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export type RestockAlertState = {
  /** Faux tant que non monté, ou si l'appareil ne sait pas faire de push :
   * le bouton ne s'affiche alors pas. */
  supported: boolean;
  active: boolean;
  pending: boolean;
  error: string | null;
  toggle: () => Promise<void>;
};

export function useRestockAlert(target: RestockAlertTarget): RestockAlertState {
  const key = restockTargetKey(target);
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Après montage seulement : pas de désaccord serveur/client.
  useEffect(() => {
    setSupported(pushLooksSupported());
    setActive(readKeys().includes(key));
  }, [key]);

  const toggle = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      const push = await import('@/lib/push-client');
      if (active) {
        const registration = await push.getServiceWorkerRegistration();
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await fetch('/api/menu/alertes', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target, endpoint: subscription.endpoint }),
          });
        }
        writeKeys(readKeys().filter((k) => k !== key));
        setActive(false);
        return;
      }

      const subscription = await push.ensurePushSubscription();
      if (!subscription) {
        setError('Autorise les notifications pour être prévenu.');
        return;
      }
      const res = await fetch('/api/menu/alertes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, subscription: subscription.toJSON() }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: unknown;
        };
        setError(
          typeof data.error === 'string'
            ? data.error
            : 'Impossible d’activer l’alerte. Réessaie.'
        );
        return;
      }
      writeKeys([...new Set([...readKeys(), key])]);
      setActive(true);
    } catch {
      setError('Impossible d’activer l’alerte. Réessaie.');
    } finally {
      setPending(false);
    }
    // `target` est reconstruit à chaque rendu : `key` le résume.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, key]);

  return { supported, active, pending, error, toggle };
}
