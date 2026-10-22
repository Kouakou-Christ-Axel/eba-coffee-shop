// lib/orders/auto-launch.ts
//
// Lancement AUTOMATIQUE en cuisine des commandes programmées PAYÉES, le jour du
// retrait. Même principe que `expirePendingOrders` (lib/jeko/expiry.ts) : pas de
// cron, l'appelant lance `void launchDueScheduledOrders().catch(() => {})` au
// chargement d'un écran dashboard, sans bloquer son rendu. Il est AUSSI rejoué
// à chaque changement de stock (`lib/menu/mutations/stock.ts`) : le stock est
// souvent à 0 le matin, la cuisine produit vers midi, et la programmée doit
// prendre sa part de cette fournée avant que le comptoir ne la vende.
//
// Le stock du jour est décompté par le chemin habituel (`sendOrderToKitchen` →
// `reserveStockOnce`), donc la commande compte naturellement dans le stock du
// jour J. Rien n'est forcé :
//   - impayée → on laisse la caisse décider (ardoise ou encaissement) ;
//   - pénurie → on ne crédite PAS le manquant (c'est une confirmation humaine),
//     la commande reste dans « Programmées » avec son bouton « Lancer la
//     préparation » manuel, qui sert de repli ;
//   - acompte manquant → même repli ;
//   - remboursement en cours ou versé → même repli : la commande a quitté les
//     files (cf. `fullyRefundedOrderIds`), la lancer réserverait du stock pour
//     rien.
//
// Tous les retraits du JOUR sont lancés, même tardifs (18 h lancé à 12 h) : le
// but est de réserver la fournée avant que le comptoir ne la vende. Ils restent
// dans « Programmées » tant que le retrait est lointain (`isScheduledAhead`).
//
// État en mémoire de processus (throttle, refus) : sans danger en multi-instance,
// `Order.stockReservedAt` et la garde de statut de `sendOrderToKitchen`
// empêchent tout double décompte ; au pire un 409 parasite, ignoré ici.

import prisma from '@/lib/prisma';
import { endOfLocalDay, startOfLocalDay } from '@/lib/timezone';
import { sendOrderToKitchen } from './mutations/kitchen';
import { OrderMutationError } from './mutations/errors';

// Un passage par minute et par processus.
const THROTTLE_MS = 60_000;
const BATCH_SIZE = 20;
// Une commande refusée (pénurie, acompte) n'est pas retentée à chaque passage.
const RETRY_AFTER_MS = 10 * 60_000;

let lastRunAt = 0;
const retryAfter = new Map<string, number>();
// Un seul passage à la fois : un réappro pendant un passage en demande UN
// nouveau derrière (coalescé), au lieu de lancer les mêmes commandes en parallèle.
let inFlight: Promise<AutoLaunchResult> | null = null;
let rerunRequested = false;

export type AutoLaunchResult = { launched: number; skipped: number };

async function runOnce(now: Date): Promise<AutoLaunchResult> {
  const result: AutoLaunchResult = { launched: 0, skipped: 0 };

  for (const [id, until] of retryAfter) {
    if (until <= now.getTime()) retryAfter.delete(id);
  }

  // staff-visibility: exempt — c'est précisément ce module qui lance les commandes programmées
  const due = await prisma.order.findMany({
    where: {
      id: { notIn: [...retryAfter.keys()] },
      status: 'NEW',
      isPaid: true,
      stockReservedAt: null,
      // Aujourd'hui seulement : une payée restée NEW d'un jour passé est
      // oubliée, pas à relancer en décomptant le stock d'aujourd'hui.
      pickupTime: { gte: startOfLocalDay(now), lte: endOfLocalDay(now) },
      refunds: {
        none: {
          status: {
            in: ['REQUESTED', 'APPROVED', 'PROCESSING', 'UNCERTAIN', 'PAID'],
          },
        },
      },
    },
    select: { id: true },
    orderBy: { pickupTime: 'asc' },
    take: BATCH_SIZE,
  });

  for (const { id } of due) {
    try {
      await sendOrderToKitchen(id, 'ADMIN', { notifyShortage: false });
      result.launched++;
    } catch (err) {
      retryAfter.set(id, now.getTime() + RETRY_AFTER_MS);
      result.skipped++;
      // 409 = pénurie, acompte manquant ou commande déjà prise par un autre
      // passage : repli manuel attendu. Tout le reste est anormal.
      if (err instanceof OrderMutationError && err.httpStatus === 409) {
        console.warn('[auto-launch] commande non lancée :', id, err.message);
      } else {
        console.error('[auto-launch] échec inattendu :', id, err);
      }
    }
  }
  return result;
}

/**
 * `force` : passage déclenché par un RÉAPPROVISIONNEMENT — le stock vient
 * d'arriver (fournée de midi), les programmées du jour doivent le réserver
 * AVANT que le comptoir ne le vende. Ni throttle ni mémoire des refus : une
 * commande refusée ce matin pour pénurie peut passer maintenant.
 */
export async function launchDueScheduledOrders(
  now: Date = new Date(),
  opts?: { force?: boolean }
): Promise<AutoLaunchResult> {
  if (inFlight) {
    if (opts?.force) rerunRequested = true;
    return { launched: 0, skipped: 0 };
  }
  if (opts?.force) {
    retryAfter.clear();
  } else if (now.getTime() - lastRunAt < THROTTLE_MS) {
    return { launched: 0, skipped: 0 };
  }

  const previousRunAt = lastRunAt;
  lastRunAt = now.getTime();
  inFlight = runOnce(now);
  try {
    return await inFlight;
  } catch (err) {
    // Panne de lecture : ne pas geler les passages normaux pendant une minute.
    lastRunAt = previousRunAt;
    console.error('[auto-launch] lecture des commandes échouée :', err);
    throw err;
  } finally {
    inFlight = null;
    if (rerunRequested) {
      rerunRequested = false;
      void launchDueScheduledOrders(new Date(), { force: true }).catch(
        () => {}
      );
    }
  }
}
