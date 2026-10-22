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
//   - acompte manquant → même repli.

import prisma from '@/lib/prisma';
import { startOfLocalDay } from '@/lib/timezone';
import { sendOrderToKitchen } from './mutations/kitchen';

// Un passage par minute et par processus (pm2 tourne en une seule instance).
const THROTTLE_MS = 60_000;
const BATCH_SIZE = 20;
// Une commande refusée (pénurie, acompte) n'est pas retentée à chaque passage.
const RETRY_AFTER_MS = 10 * 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;

let lastRunAt = 0;
const retryAfter = new Map<string, number>();

export type AutoLaunchResult = { launched: number; skipped: number };

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
  const result: AutoLaunchResult = { launched: 0, skipped: 0 };
  if (opts?.force) {
    retryAfter.clear();
  } else if (now.getTime() - lastRunAt < THROTTLE_MS) {
    return result;
  }
  lastRunAt = now.getTime();

  for (const [id, until] of retryAfter) {
    if (until <= now.getTime()) retryAfter.delete(id);
  }

  const dayStart = startOfLocalDay(now);
  const dayEnd = new Date(dayStart.getTime() + DAY_MS);

  // staff-visibility: exempt — c'est précisément ce module qui lance les commandes programmées
  const due = await prisma.order.findMany({
    where: {
      id: { notIn: [...retryAfter.keys()] },
      status: 'NEW',
      isPaid: true,
      stockReservedAt: null,
      // Aujourd'hui seulement : une payée restée NEW d'un jour passé est
      // oubliée, pas à relancer en décomptant le stock d'aujourd'hui.
      pickupTime: { gte: dayStart, lt: dayEnd },
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
      // Pénurie, acompte manquant ou état déjà modifié : repli manuel.
      retryAfter.set(id, now.getTime() + RETRY_AFTER_MS);
      result.skipped++;
      console.warn('[auto-launch] commande non lancée :', id, err);
    }
  }
  return result;
}
