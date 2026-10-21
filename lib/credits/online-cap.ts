// lib/credits/online-cap.ts
//
// Plafond journalier d'avoir dépensé EN LIGNE par un client. Compté sur le jour
// civil (Abidjan = UTC) à partir du journal : dépenses moins restitutions des
// commandes en ligne, de sorte qu'un paiement expiré (avoir rendu) libère le plafond.

import type { Prisma } from '@/generated/prisma/client';
import { todayDailyDate } from '@/lib/daily-numbering';

/** FCFA encore dépensables en ligne aujourd'hui par ce client (≥ 0). */
export async function remainingOnlineCap(
  tx: Pick<Prisma.TransactionClient, 'customerCreditEntry' | 'order'>,
  customerId: string,
  dailyCap: number
): Promise<number> {
  const since = todayDailyDate();
  const entries = await tx.customerCreditEntry.findMany({
    where: {
      customerId,
      kind: { in: ['SPENT', 'RESTORED'] },
      orderId: { not: null },
      createdAt: { gte: since },
    },
    select: { delta: true, orderId: true },
  });
  if (entries.length === 0) return Math.max(0, dailyCap);
  // staff-visibility: exempt — comptabilité de l'avoir du client, pas une liste staff
  const online = await tx.order.findMany({
    where: {
      id: { in: entries.map((e) => e.orderId as string) },
      source: 'ONLINE',
    },
    select: { id: true },
  });
  const onlineIds = new Set(online.map((o) => o.id));
  const spent = entries
    .filter((e) => onlineIds.has(e.orderId as string))
    .reduce((s, e) => s - e.delta, 0);
  return Math.max(0, dailyCap - Math.max(0, spent));
}
