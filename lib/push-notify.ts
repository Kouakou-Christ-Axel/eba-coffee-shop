// lib/push-notify.ts
//
// Envoi de notifications push (backoffice) via web-push/VAPID. Branché depuis
// lib/order-mutations.ts (nouvelle commande, commande prête). Fire-and-forget :
// un échec d'envoi ne doit jamais faire échouer la mutation qui l'a déclenché
// (chaque appelant l'entoure d'un `catch` silencieux/loggé).
//
// Si NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY ne sont pas configurées,
// la fonctionnalité est inerte (aucun envoi, pas d'erreur).

import webPush from 'web-push';
import prisma from '@/lib/prisma';
import { getPushSubscriptionsForRoles } from '@/lib/push-subscriptions';
import type { UserRole } from '@/generated/prisma/client';

export type PushPayload = {
  title: string;
  body: string;
  /** Chemin relatif ouvert au clic (ex. /dashboard/caisse). */
  url?: string;
  /** Regroupe/replace les notifications du même type (ex. "new-order"). */
  tag?: string;
};

let vapidConfigured = false;

function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;

  webPush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:contact@ebacoffeeshop.com',
    publicKey,
    privateKey
  );
  vapidConfigured = true;
  return true;
}

type RawSubscription = {
  id?: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

/** Envoi bas niveau, partagé par `sendPushToRoles` et `sendTestPush`. */
async function sendToSubscriptions(
  subscriptions: RawSubscription[],
  payload: PushPayload
): Promise<void> {
  if (!ensureVapidConfigured()) return;
  if (subscriptions.length === 0) return;

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload)
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          if (sub.id) {
            await prisma.pushSubscription
              .delete({ where: { id: sub.id } })
              .catch(() => {
                // Déjà supprimé entre-temps : ignorer.
              });
          }
        } else {
          console.error('[push-notify] envoi échoué :', err);
        }
      }
    })
  );
}

/**
 * Envoie `payload` à tout le staff dont le rôle figure dans `roles`. Nettoie
 * automatiquement les abonnements expirés (404/410 renvoyés par le navigateur).
 */
export async function sendPushToRoles(
  roles: UserRole[],
  payload: PushPayload
): Promise<void> {
  const subscriptions = await getPushSubscriptionsForRoles(roles);
  await sendToSubscriptions(subscriptions, payload);
}

/**
 * Notification de confirmation envoyée au SEUL abonnement qui vient d'être
 * créé, juste après l'activation (bouton cloche du dashboard) — preuve
 * immédiate que l'abonnement fonctionne, sans attendre un vrai événement.
 */
export async function sendTestPush(
  subscription: Pick<RawSubscription, 'endpoint' | 'p256dh' | 'auth'>
): Promise<void> {
  await sendToSubscriptions([subscription], {
    title: 'Notifications activées ✅',
    body: 'Vous recevrez désormais les alertes EBA Coffee Shop (nouvelles commandes, commandes prêtes).',
    tag: 'push-test',
  });
}
