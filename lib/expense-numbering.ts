// lib/expense-numbering.ts
//
// Numérotation des reçus de dépense : DEP-YYYY-MM-NNNN, compteur (receiptSeq)
// remis à zéro chaque mois civil. Miroir de lib/daily-numbering.ts (commandes).
//
// Le numéro est attribué à la création et IMMUABLE : on ne le recalcule jamais
// lors d'une modification (principe comptable). Le mois d'attribution
// (receiptPeriod) est figé à partir de la `date` au moment de la création.

import type { Prisma } from '@/generated/prisma/client';

const MAX_RETRIES = 3;

const RECEIPT_PREFIX = 'DEP';
const RECEIPT_SEQ_PAD = 4;

/**
 * Mois d'attribution "YYYY-MM" depuis une Date @db.Date. La date d'une dépense
 * est stockée à minuit UTC (Abidjan = UTC+0), donc les composantes UTC donnent
 * directement le jour civil métier.
 */
export function receiptPeriodFromDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Libellé reçu formaté, ex. formatReceiptNo('2026-06', 1) → 'DEP-2026-06-0001'. */
export function formatReceiptNo(period: string, seq: number): string {
  return `${RECEIPT_PREFIX}-${period}-${String(seq).padStart(RECEIPT_SEQ_PAD, '0')}`;
}

/**
 * Prochaine séquence de reçu pour le mois donné.
 *
 * Stratégie thread-safe (identique aux numéros de commande) :
 *   1. SELECT MAX(receiptSeq) + 1 dans une transaction
 *   2. L'index unique (receiptPeriod, receiptSeq) attrape les races
 *   3. Retry jusqu'à RECEIPT_NUMBER_MAX_RETRIES sur conflit (P2002)
 */
export async function getNextReceiptSeq(
  tx: Prisma.TransactionClient,
  period: string
): Promise<number> {
  const result = await tx.expense.aggregate({
    where: { receiptPeriod: period },
    _max: { receiptSeq: true },
  });
  return (result._max.receiptSeq ?? 0) + 1;
}

export const RECEIPT_NUMBER_MAX_RETRIES = MAX_RETRIES;
