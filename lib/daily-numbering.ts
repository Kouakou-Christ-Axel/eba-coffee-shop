import type { Prisma } from '@/generated/prisma/client';
import { startOfLocalDay } from '@/lib/timezone';

const MAX_RETRIES = 3;

/**
 * Calcule le prochain numéro de commande pour la journée donnée.
 *
 * Stratégie thread-safe :
 *   1. SELECT MAX(dailyNumber) + 1 dans une transaction
 *   2. L'index unique (dailyDate, dailyNumber) attrape les races
 *   3. Retry jusqu'à MAX_RETRIES sur conflit
 *
 * À appeler depuis createOrder/createCashierOrder, jamais en parallèle pour la
 * même commande.
 */
export async function getNextDailyNumber(
  tx: Prisma.TransactionClient,
  dailyDate: Date
): Promise<number> {
  const result = await tx.order.aggregate({
    where: { dailyDate },
    _max: { dailyNumber: true },
  });
  const current = result._max.dailyNumber ?? 0;
  return current + 1;
}

/** Helper : renvoie startOfLocalDay(new Date()) — utilisé partout pour aligner. */
export function todayDailyDate(): Date {
  return startOfLocalDay(new Date());
}

export const DAILY_NUMBER_MAX_RETRIES = MAX_RETRIES;
