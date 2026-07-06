'use client';

import * as React from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Clé publique VAPID : exposée côté client (NEXT_PUBLIC_*). Absente en dev tant
// que .env n'est pas configuré — le bouton se masque alors silencieusement.
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

// PushManager.subscribe attend la clé serveur en BufferSource, pas en base64url.
function urlBase64ToUint8Array(base64Url: string): BufferSource {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from(rawData, (c) => c.charCodeAt(0)) as BufferSource;
}

type Status =
  | 'idle'
  | 'checking'
  | 'subscribed'
  | 'unsubscribed'
  | 'unsupported';

export function PushNotificationToggle() {
  const [status, setStatus] = React.useState<Status>('idle');
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (!VAPID_PUBLIC_KEY) {
      setStatus('unsupported');
      return;
    }
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window)
    ) {
      setStatus('unsupported');
      return;
    }

    setStatus('checking');
    (async () => {
      // Le dashboard peut être la toute première page visitée (lien direct,
      // signet) : le SW n'est alors pas encore enregistré par InstallPwa
      // (monté uniquement côté public). `register()` est idempotent.
      await navigator.serviceWorker.register('/sw.js');
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      setStatus(existing ? 'subscribed' : 'unsubscribed');
    })().catch(() => setStatus('unsubscribed'));
  }, []);

  const subscribe = React.useCallback(async () => {
    if (!VAPID_PUBLIC_KEY) return;
    setPending(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus('unsubscribed');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      });
      setStatus('subscribed');
    } catch (err) {
      console.error('[push] abonnement échoué :', err);
      setStatus('unsubscribed');
    } finally {
      setPending(false);
    }
  }, []);

  const unsubscribe = React.useCallback(async () => {
    setPending(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setStatus('unsubscribed');
    } finally {
      setPending(false);
    }
  }, []);

  if (status === 'unsupported' || status === 'idle' || status === 'checking') {
    return null;
  }

  const isSubscribed = status === 'subscribed';

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={isSubscribed ? unsubscribe : subscribe}
      aria-label={
        isSubscribed
          ? 'Désactiver les notifications'
          : 'Activer les notifications'
      }
      title={
        isSubscribed
          ? 'Notifications activées — cliquer pour désactiver'
          : 'Activer les notifications (nouvelles commandes, commandes prêtes)'
      }
    >
      {isSubscribed ? (
        <BellRing className="text-primary" />
      ) : pending ? (
        <Bell />
      ) : (
        <BellOff />
      )}
    </Button>
  );
}
