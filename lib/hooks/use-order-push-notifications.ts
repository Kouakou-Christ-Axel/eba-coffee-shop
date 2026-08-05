'use client';

// lib/hooks/use-order-push-notifications.ts
//
// État + actions des notifications push pour LA commande suivie par cet
// appareil, partagés entre le bloc inline (order-notifications.tsx) et la
// popup d'incitation (order-notifications-modal.tsx). Un appareil suit une
// commande à la fois (localStorage + upsert par endpoint côté serveur).
//
// Cas « permission déjà accordée » (client déjà abonné sur une commande
// précédente) : on rebascule l'appareil sur CETTE commande automatiquement,
// sans rien demander — Notification.requestPermission() résout aussitôt côté
// navigateur quand la décision a déjà été prise, donc l'appel est silencieux.
// C'est ce qui évite de redemander l'activation à chaque commande.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ensurePushSubscription,
  getServiceWorkerRegistration,
  isPushSupported,
} from '@/lib/push-client';

/** Commande suivie par CET appareil (une seule à la fois). */
const STORAGE_KEY = 'eba-push-order';

export type PushStatus = 'hidden' | 'off' | 'denied' | 'on';

export function useOrderPushNotifications({
  orderId,
  isFinal,
}: {
  orderId: string;
  isFinal: boolean;
}) {
  const [status, setStatus] = useState<PushStatus>('hidden');
  const [pending, setPending] = useState(false);
  // Une seule tentative de resouscription silencieuse par montage/commande.
  const autoTried = useRef(false);

  const enable = useCallback(async () => {
    setPending(true);
    try {
      const subscription = await ensurePushSubscription();
      if (!subscription) {
        setStatus(Notification.permission === 'denied' ? 'denied' : 'off');
        return false;
      }

      const res = await fetch(`/api/commandes/${orderId}/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      localStorage.setItem(STORAGE_KEY, orderId);
      setStatus('on');
      return true;
    } catch (err) {
      console.error('[push] activation échouée :', err);
      setStatus('off');
      return false;
    } finally {
      setPending(false);
    }
  }, [orderId]);

  const disable = useCallback(async () => {
    setPending(true);
    try {
      const registration = await getServiceWorkerRegistration();
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch(`/api/commandes/${orderId}/notifications`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      localStorage.removeItem(STORAGE_KEY);
      setStatus('off');
    } catch (err) {
      console.error('[push] désactivation échouée :', err);
    } finally {
      setPending(false);
    }
  }, [orderId]);

  useEffect(() => {
    autoTried.current = false;
    if (isFinal || !isPushSupported()) {
      setStatus('hidden');
      return;
    }
    if (Notification.permission === 'denied') {
      setStatus('denied');
      return;
    }
    (async () => {
      const registration = await getServiceWorkerRegistration();
      const subscription = await registration.pushManager.getSubscription();
      const followedOrder = localStorage.getItem(STORAGE_KEY);
      if (subscription && followedOrder === orderId) {
        setStatus('on');
        return;
      }
      if (Notification.permission === 'granted' && !autoTried.current) {
        autoTried.current = true;
        await enable();
        return;
      }
      setStatus('off');
    })().catch(() => setStatus('off'));
  }, [orderId, isFinal, enable]);

  return { status, pending, enable, disable };
}
