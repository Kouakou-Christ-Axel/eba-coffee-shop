// lib/credits/spend.ts
//
// Avoir d'une commande : prise sur le solde du client et restitution. La colonne
// `Order.creditApplied` dit combien est actuellement retenu pour cette commande,
// ce qui rend chaque opération idempotente (restituer deux fois ne rend qu'une
// fois) et permet d'ajuster sans double débit.

import type { Prisma } from '@/generated/prisma/client';
import { computeCreditApplication } from './apply';
import { CreditError } from './errors';
import { moveCredit } from './ledger';
import { creditSettingsFromRow } from '@/lib/credit-settings';

export type PaymentLine = { mode: string; amount: number };

/** Somme des lignes AVOIR d'un paiement (0 s'il n'y en a pas). */
export function creditAmountOf(lines: PaymentLine[]): number {
  return lines
    .filter((l) => l.mode === 'AVOIR')
    .reduce((s, l) => s + l.amount, 0);
}

/** Lignes d'argent réel : tout sauf l'avoir. */
export function moneyLines<T extends PaymentLine>(lines: T[]): T[] {
  return lines.filter((l) => l.mode !== 'AVOIR');
}

/** Part d'avoir que la règle autorise sur `total`, `current` déjà retenu inclus. */
async function allowedCredit(
  tx: Prisma.TransactionClient,
  customerId: string,
  total: number,
  current: number
): Promise<number> {
  const settings = creditSettingsFromRow(
    await tx.creditSettings.findUnique({ where: { id: 'singleton' } })
  );
  const rows = await tx.$queryRaw<{ creditBalance: number }[]>`
    SELECT "creditBalance" FROM "customer" WHERE "id" = ${customerId} FOR UPDATE`;
  const balance = rows[0]?.creditBalance ?? 0;
  // Le solde disponible pour la règle compte ce que la commande retient déjà.
  return computeCreditApplication({
    balance: balance + current,
    total,
    settings,
  });
}

/**
 * Aligne l'avoir retenu pour la commande sur `wanted` : débite la différence
 * (règle d'usage imposée côté serveur, jamais crue du navigateur) ou rend le
 * trop-perçu. `customerId` nul avec `wanted > 0` est refusé.
 */
export async function setOrderCredit(
  tx: Prisma.TransactionClient,
  args: {
    orderId: string;
    customerId: string | null;
    total: number;
    current: number;
    wanted: number;
    actorId?: string | null;
    /** Rejoue un paiement déjà accepté (reprise d'une annulée) : règle non revérifiée. */
    skipRule?: boolean;
  }
): Promise<void> {
  const { orderId, customerId, total, current, wanted, actorId } = args;
  if (wanted === current) return;
  if (!customerId) {
    if (wanted === 0) return;
    throw new CreditError(
      'Aucun client sur cette commande : l’avoir ne peut pas être utilisé',
      409
    );
  }
  if (wanted > current) {
    const allowed = args.skipRule
      ? wanted
      : await allowedCredit(tx, customerId, total, current);
    if (wanted > allowed) {
      throw new CreditError(
        `L’avoir ne peut pas dépasser ${allowed} F sur cette commande`,
        409
      );
    }
    await moveCredit(tx, {
      customerId,
      delta: -(wanted - current),
      kind: 'SPENT',
      orderId,
      note: 'Avoir utilisé sur une commande',
      actorId,
    });
  } else {
    await moveCredit(tx, {
      customerId,
      delta: current - wanted,
      kind: 'RESTORED',
      orderId,
      note: 'Avoir rendu',
      actorId,
    });
  }
  await tx.order.update({
    where: { id: orderId },
    data: { creditApplied: wanted },
  });
}

/** Rend à son client tout l'avoir retenu pour la commande (no-op s'il n'y en a pas). */
export async function restoreOrderCredit(
  tx: Prisma.TransactionClient,
  orderId: string,
  actorId?: string | null
): Promise<number> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { customerId: true, creditApplied: true, total: true },
  });
  if (!order || order.creditApplied <= 0) return 0;
  const amount = order.creditApplied;
  await setOrderCredit(tx, {
    orderId,
    customerId: order.customerId,
    total: order.total,
    current: amount,
    wanted: 0,
    actorId,
  });
  return amount;
}

/**
 * Paiement en ligne : retient d'emblée l'avoir autorisé par la règle (le montant
 * Jèko en dépend). Rendu si le paiement n'arrive jamais (`restoreOrderCredit`).
 * Renvoie le montant retenu (0 = rien).
 */
export async function holdCreditForOrder(
  tx: Prisma.TransactionClient,
  args: { orderId: string; customerId: string; total: number }
): Promise<number> {
  const amount = await allowedCredit(tx, args.customerId, args.total, 0);
  if (amount <= 0) return 0;
  await setOrderCredit(tx, { ...args, current: 0, wanted: amount });
  return amount;
}
