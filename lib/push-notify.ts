// lib/push-notify.ts
//
// Envoi de notifications push via web-push/VAPID, deux publics :
//   - STAFF (`sendPushToRoles`) : nouvelle commande, commande prête — branché
//     depuis lib/order-mutations.ts et lib/orders.ts ;
//   - CLIENT (`sendPushToOrder`) : changements de statut de SA commande —
//     appareils abonnés depuis la page publique de suivi.
// Fire-and-forget : un échec d'envoi ne doit jamais faire échouer la mutation
// qui l'a déclenché (chaque appelant l'entoure d'un `catch` silencieux/loggé).
//
// Si NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY ne sont pas configurées,
// la fonctionnalité est inerte (aucun envoi, pas d'erreur).

import webPush from 'web-push';
import prisma from '@/lib/prisma';
import {
  getPushSubscriptionsForOrder,
  getPushSubscriptionsForRoles,
  removePushSubscriptionsForOrder,
} from '@/lib/push-subscriptions';
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
 * Envoie `payload` aux appareils clients abonnés au suivi de la commande
 * `orderId`. `lastForOrder: true` (commande récupérée/annulée) supprime les
 * abonnements APRÈS l'envoi : plus rien à notifier ensuite.
 */
export async function sendPushToOrder(
  orderId: string,
  payload: PushPayload,
  opts: { lastForOrder?: boolean } = {}
): Promise<void> {
  const subscriptions = await getPushSubscriptionsForOrder(orderId);
  await sendToSubscriptions(subscriptions, payload);
  if (opts.lastForOrder) {
    await removePushSubscriptionsForOrder(orderId);
  }
}

// ─── Messages client (page de suivi) ─────────────────────────────────────────
//
// Un message par étape de vie de la commande, côté CLIENT (tutoiement, ton du
// site). `PAYMENT` = paiement validé seul ; `PAYMENT_PREPARING` = encaissement
// qui envoie aussi la commande en cuisine (NEW → PREPARING), fusionné en une
// seule notification.

export type CustomerNotificationKind =
  | 'PREPARING'
  | 'READY'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'PAYMENT'
  | 'PAYMENT_PREPARING'
  | 'ITEM_UNAVAILABLE';

const CUSTOMER_MESSAGES: Record<
  CustomerNotificationKind,
  { title: string; body: string }
> = {
  PREPARING: {
    title: 'Commande en préparation ☕',
    body: 'C’est parti ! On te prévient dès que c’est prêt.',
  },
  READY: {
    title: 'Ta commande est prête ! 🎉',
    body: 'Tu peux venir la récupérer ou envoyer ton livreur dès maintenant.',
  },
  COMPLETED: {
    title: 'Commande récupérée',
    body: 'Merci et à bientôt chez EBA Coffee Shop ☕',
  },
  CANCELLED: {
    title: 'Commande annulée',
    body: 'Contacte le comptoir si tu penses qu’il s’agit d’une erreur.',
  },
  PAYMENT: {
    title: 'Paiement validé ✅',
    body: 'Ton paiement a bien été reçu.',
  },
  PAYMENT_PREPARING: {
    title: 'Paiement validé ✅',
    body: 'Ta commande part en préparation — on te prévient quand c’est prêt.',
  },
  ITEM_UNAVAILABLE: {
    title: 'Article épuisé',
    body: 'Un article de ta commande n’est plus disponible. Choisis-en un autre 🙏',
  },
};

/** Fin de vie de la commande : dernière notification, puis désabonnement. */
const LAST_KINDS: ReadonlySet<CustomerNotificationKind> = new Set([
  'COMPLETED',
  'CANCELLED',
]);

/**
 * Notifie les appareils clients abonnés à la commande `orderId` d'un événement
 * de son cycle de vie. Fire-and-forget : à appeler sans `await` depuis les
 * mutations (l'erreur est logguée ici).
 */
export function notifyOrderCustomer(
  orderId: string,
  kind: CustomerNotificationKind
): void {
  const message = CUSTOMER_MESSAGES[kind];
  sendPushToOrder(
    orderId,
    {
      ...message,
      url: `/commande/${orderId}`,
      // Un seul fil de notifications par commande : la plus récente remplace.
      tag: `order-status-${orderId}`,
    },
    { lastForOrder: LAST_KINDS.has(kind) }
  ).catch((err) => {
    console.error('[push-notify] notification client échouée :', err);
  });
}

/**
 * Notification de confirmation envoyée au SEUL abonnement qui vient d'être
 * créé, juste après l'activation (cloche du dashboard ou page de suivi) —
 * preuve immédiate que l'abonnement fonctionne, sans attendre un vrai
 * événement. `payload` permet d'adapter le message au public (staff/client).
 */
export async function sendTestPush(
  subscription: Pick<RawSubscription, 'endpoint' | 'p256dh' | 'auth'>,
  payload: PushPayload = {
    title: 'Notifications activées ✅',
    body: 'Vous recevrez désormais les alertes EBA Coffee Shop (nouvelles commandes, commandes prêtes).',
    tag: 'push-test',
  }
): Promise<void> {
  await sendToSubscriptions([subscription], payload);
}
