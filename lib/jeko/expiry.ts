// lib/jeko/expiry.ts
//
// Expiration OPPORTUNISTE des commandes en attente de paiement Jèko. Pas de cron :
// le rappel d'inventaire part déjà au chargement du dashboard
// (`app/(dashboard)/dashboard/page.tsx`), on fait pareil — l'appelant lance
// `void expirePendingOrders().catch(() => {})` sans bloquer son rendu.
//
// Le webhook Jèko ne signale QUE les succès : un abandon ou un échec ne déclenche
// rien. C'est donc ici qu'on le constate, après avoir interrogé Jèko :
//   - paiement réussi  → on règle (jamais d'annulation d'une commande payée) ;
//   - Jèko injoignable → on n'expire PAS, on réessaiera au prochain passage ;
//   - sinon            → annulation SYSTÈME, qui défait la fidélité.
//
// L'annulation n'emprunte pas `setOrderStatus` : il exige un rôle de staff, garde
// la récompense sur la commande (`keepUsedReward`) et notifie « annulée par le
// staff ». Ici le client récupère sa récompense et la page de suivi montre
// simplement « expirée ».

import prisma from '@/lib/prisma';
import { revokeLoyaltyForOrder } from '@/lib/loyalty-mutations';
import { getJekoPaymentRequest } from './client';
import { jekoConfig } from './config';
import { settleFromRemote } from './reconcile';

// Marge après `paymentExpiresAt` : laisse le temps au webhook d'une tentative
// juste à l'échéance.
const GRACE_MS = 2 * 60_000;
// Un passage par minute et par processus (pm2 tourne en une seule instance).
const THROTTLE_MS = 60_000;
const BATCH_SIZE = 20;

let lastRunAt = 0;

type Overdue = {
  id: string;
  customerId: string | null;
  loyaltyRewardId: string | null;
  paymentRequestId: string | null;
};

export type ExpiryResult = {
  expired: number;
  settled: number;
  skipped: number;
};

async function expireOrder(order: Overdue): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    // Gardé sur `isPaid:false` et `NEW` : une commande payée ou déjà prise en
    // charge entre-temps n'est pas touchée, sa fidélité non plus.
    const updated = await tx.order.updateMany({
      where: { id: order.id, isPaid: false, status: 'NEW' },
      data: { status: 'CANCELLED' },
    });
    if (updated.count === 0) return false;

    if (order.customerId) {
      await revokeLoyaltyForOrder(tx, {
        orderId: order.id,
        customerId: order.customerId,
        usedRewardId: order.loyaltyRewardId,
        note: 'Paiement en ligne expiré',
      });
    }
    return true;
  });
}

export async function expirePendingOrders(
  now: Date = new Date()
): Promise<ExpiryResult> {
  const result: ExpiryResult = { expired: 0, settled: 0, skipped: 0 };
  if (now.getTime() - lastRunAt < THROTTLE_MS) return result;
  lastRunAt = now.getTime();

  // staff-visibility: exempt — c'est précisément ce module qui traite les commandes en attente de paiement
  const overdue = await prisma.order.findMany({
    where: {
      source: 'ONLINE',
      isPaid: false,
      status: 'NEW',
      // `onlineFee` non nul = commande créée pour un paiement en ligne.
      onlineFee: { not: null },
      paymentExpiresAt: { lt: new Date(now.getTime() - GRACE_MS) },
    },
    select: {
      id: true,
      customerId: true,
      loyaltyRewardId: true,
      paymentRequestId: true,
    },
    orderBy: { paymentExpiresAt: 'asc' },
    take: BATCH_SIZE,
  });

  const config = jekoConfig();

  for (const order of overdue) {
    try {
      if (config && order.paymentRequestId) {
        const remote = await getJekoPaymentRequest(
          config,
          order.paymentRequestId
        );
        if (remote.status === 'success') {
          if ((await settleFromRemote(remote)) === 'unreadable') {
            // Succès sans détail de transaction : on ne peut ni régler ni
            // expirer sans risque, on laisse la main au prochain passage.
            result.skipped++;
          } else {
            result.settled++;
          }
          continue;
        }
      }
      if (await expireOrder(order)) result.expired++;
    } catch (err) {
      console.error(`[jeko] expiration de ${order.id} reportée :`, err);
      result.skipped++;
    }
  }

  return result;
}
