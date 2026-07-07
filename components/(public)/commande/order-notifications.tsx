'use client';

// components/(public)/commande/order-notifications.tsx
//
// Bloc « Sois prévenu en direct » de la page publique de suivi : le client
// active les notifications push pour SA commande (préparation, prête,
// récupérée, paiement validé) — plus besoin de garder la page ouverte.
//
// L'appareil suit une commande à la fois (localStorage + upsert par endpoint
// côté serveur) : activer ici bascule l'appareil sur cette commande. Masqué si
// non supporté (dont Safari iOS hors PWA installée) ou commande terminée.

import { useCallback, useEffect, useState } from 'react';
import { Button, Chip } from '@heroui/react';
import { Bell, BellRing } from 'lucide-react';
import {
  ensurePushSubscription,
  getServiceWorkerRegistration,
  isPushSupported,
} from '@/lib/push-client';

/** Commande suivie par CET appareil (une seule à la fois). */
const STORAGE_KEY = 'eba-push-order';

type Status = 'hidden' | 'off' | 'denied' | 'on';

export function OrderNotifications({
  orderId,
  isFinal,
}: {
  orderId: string;
  isFinal: boolean;
}) {
  const [status, setStatus] = useState<Status>('hidden');
  const [pending, setPending] = useState(false);

  useEffect(() => {
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
      setStatus(subscription && followedOrder === orderId ? 'on' : 'off');
    })().catch(() => setStatus('off'));
  }, [orderId, isFinal]);

  const enable = useCallback(async () => {
    setPending(true);
    try {
      const subscription = await ensurePushSubscription();
      if (!subscription) {
        setStatus(Notification.permission === 'denied' ? 'denied' : 'off');
        return;
      }

      const res = await fetch(`/api/commandes/${orderId}/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      localStorage.setItem(STORAGE_KEY, orderId);
      setStatus('on');
    } catch (err) {
      console.error('[push] activation échouée :', err);
      setStatus('off');
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

  if (status === 'hidden') return null;

  return (
    <div className="rounded-xl border border-foreground/10 bg-default-50 p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground/40">
          {status === 'on' ? (
            <BellRing className="h-4 w-4 text-primary" />
          ) : (
            <Bell className="h-4 w-4" />
          )}
          Notifications
        </p>
        {status === 'on' && (
          <Chip color="success" variant="flat" size="sm">
            Activées
          </Chip>
        )}
      </div>

      {status === 'denied' ? (
        <p className="mt-3 text-xs text-foreground/60">
          Les notifications sont bloquées dans ton navigateur. Autorise-les dans
          les réglages du site pour être prévenu quand ta commande est prête.
        </p>
      ) : status === 'on' ? (
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-sm text-foreground/70">
            On te prévient dès que ta commande avance — tu peux fermer cette
            page.
          </p>
          <Button
            variant="light"
            size="sm"
            isDisabled={pending}
            onPress={disable}
          >
            Désactiver
          </Button>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-sm text-foreground/70">
            Reçois une notification quand ta commande avance — surtout quand
            c&apos;est <span className="font-semibold">prêt</span>. Plus besoin
            de garder la page ouverte.
          </p>
          <Button
            color="primary"
            variant="flat"
            size="lg"
            className="w-full"
            isLoading={pending}
            onPress={enable}
            startContent={!pending && <Bell className="h-4 w-4" />}
          >
            Activer les notifications
          </Button>
        </div>
      )}
    </div>
  );
}
