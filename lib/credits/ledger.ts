// lib/credits/ledger.ts
//
// Seul point d'écriture du solde d'avoir. Verrou de ligne sur le client : deux
// encaissements simultanés lisent chacun le solde à jour et ne peuvent pas le
// dépenser deux fois. Chaque mouvement laisse une ligne `CustomerCreditEntry`.

import type { CreditEntryKind, Prisma } from '@/generated/prisma/client';
import { CreditError } from './errors';

export type CreditMovement = {
  customerId: string;
  /** FCFA, signé : + crédite, − débite. */
  delta: number;
  kind: CreditEntryKind;
  orderId?: string | null;
  refundId?: string | null;
  note?: string | null;
  actorId?: string | null;
};

/** Applique un mouvement dans la transaction fournie et renvoie le nouveau solde. */
export async function moveCredit(
  tx: Prisma.TransactionClient,
  m: CreditMovement
): Promise<number> {
  if (!Number.isInteger(m.delta) || m.delta === 0) {
    throw new CreditError('Montant d’avoir invalide');
  }
  const rows = await tx.$queryRaw<{ creditBalance: number }[]>`
    SELECT "creditBalance" FROM "customer" WHERE "id" = ${m.customerId} FOR UPDATE`;
  const row = rows[0];
  if (!row) throw new CreditError('Client introuvable', 404);
  const next = row.creditBalance + m.delta;
  if (next < 0) {
    throw new CreditError(
      `Solde d’avoir insuffisant (${row.creditBalance} F disponibles)`,
      409
    );
  }
  await tx.customer.update({
    where: { id: m.customerId },
    data: { creditBalance: next },
  });
  await tx.customerCreditEntry.create({
    data: {
      customerId: m.customerId,
      kind: m.kind,
      delta: m.delta,
      balanceAfter: next,
      orderId: m.orderId ?? null,
      refundId: m.refundId ?? null,
      note: m.note ?? null,
      actorId: m.actorId ?? null,
    },
  });
  return next;
}
