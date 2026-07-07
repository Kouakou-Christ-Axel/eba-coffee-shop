'use client';

import * as React from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ensurePushSubscription,
  getServiceWorkerRegistration,
  isPushSupported,
} from '@/lib/push-client';

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
    if (!isPushSupported()) {
      setStatus('unsupported');
      return;
    }

    setStatus('checking');
    (async () => {
      // Le dashboard peut être la toute première page visitée (lien direct,
      // signet) : le SW n'est alors pas encore enregistré par InstallPwa
      // (monté uniquement côté public). `register()` est idempotent.
      const registration = await getServiceWorkerRegistration();
      const existing = await registration.pushManager.getSubscription();
      setStatus(existing ? 'subscribed' : 'unsubscribed');
    })().catch(() => setStatus('unsubscribed'));
  }, []);

  const subscribe = React.useCallback(async () => {
    setPending(true);
    try {
      const subscription = await ensurePushSubscription();
      if (!subscription) {
        setStatus('unsubscribed');
        return;
      }

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
      const registration = await getServiceWorkerRegistration();
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
