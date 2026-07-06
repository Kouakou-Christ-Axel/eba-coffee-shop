// lib/push-subscriptions.ts
//
// Accès aux abonnements Web Push (table push_subscription). Persistance pure —
// l'envoi effectif des notifications vit dans lib/push-notify.ts.

import prisma from '@/lib/prisma';
import type { UserRole } from '@/generated/prisma/client';
import type { PushSubscriptionInput } from '@/lib/schemas/push';

/**
 * Enregistre (ou met à jour) l'abonnement d'un utilisateur staff. `endpoint`
 * identifie l'abonnement côté navigateur : un même endpoint réabonné (ex.
 * après renouvellement des clés) met simplement à jour les clés/utilisateur.
 */
export async function savePushSubscription(
  userId: string,
  subscription: PushSubscriptionInput,
  userAgent?: string | null
) {
  return prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    create: {
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: userAgent ?? null,
    },
    update: {
      userId,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: userAgent ?? null,
    },
  });
}

/** Supprime un abonnement (désactivation côté navigateur ou nettoyage 404/410). */
export async function removePushSubscription(endpoint: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
}

/** Abonnements de tout le staff dont le rôle figure dans `roles`. */
export async function getPushSubscriptionsForRoles(roles: UserRole[]) {
  return prisma.pushSubscription.findMany({
    where: { user: { role: { in: roles } } },
  });
}
