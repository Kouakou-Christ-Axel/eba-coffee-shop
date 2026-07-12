// lib/stats-operations.ts
//
// Stats opérationnelles : heures de pointe et performance cuisine.
// Même conventions que `lib/stats.ts` : plages inclusives sur Order.dailyDate
// (jour civil Abidjan, minuit UTC), commandes CANCELLED exclues, agrégation JS
// (volume faible, et Prisma ne sait pas grouper par heure — même choix que
// `getDailySeries`).

import prisma from '@/lib/prisma';
import { formatLocalDateOnly } from '@/lib/timezone';

export type HourlyPoint = {
  /** Heure d'Abidjan, 0..23 (Abidjan = UTC+0 → composante UTC de createdAt). */
  hour: number;
  orders: number;
  revenue: number;
};

/**
 * Répartition des commandes et du CA par heure de la journée (24 points,
 * heures vides à 0), agrégée sur la plage. `orders` exclut les CANCELLED ;
 * `revenue` = commandes isPaid non annulées. Les régularisations de recette
 * n'ont pas d'heure : elles sont volontairement absentes du CA horaire.
 */
export async function getHourlyDistribution(
  from: Date,
  to: Date
): Promise<HourlyPoint[]> {
  const rows = await prisma.order.findMany({
    where: { dailyDate: { gte: from, lte: to }, status: { not: 'CANCELLED' } },
    select: { createdAt: true, total: true, isPaid: true },
  });

  const points: HourlyPoint[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    orders: 0,
    revenue: 0,
  }));

  for (const r of rows) {
    const point = points[r.createdAt.getUTCHours()];
    point.orders++;
    if (r.isPaid) point.revenue += r.total;
  }

  return points;
}

type DurationStats = {
  /** Nombre de commandes effectivement mesurables (deux bornes présentes). */
  measured: number;
  /** null (pas 0) quand aucune commande n'est mesurable. */
  avgSec: number | null;
  medianSec: number | null;
};

export type KitchenStats = {
  from: Date;
  to: Date;
  /** preparingStartedAt → readyAt (temps de préparation). */
  prep: DurationStats;
  /** createdAt → preparingStartedAt (attente avant prise en charge). */
  wait: DurationStats;
  /** Tendance jour par jour du temps de préparation (jours sans mesure = null). */
  byDay: { date: string; avgPrepSec: number | null; measured: number }[];
};

function summarize(durationsSec: number[]): DurationStats {
  if (durationsSec.length === 0) {
    return { measured: 0, avgSec: null, medianSec: null };
  }
  const sorted = [...durationsSec].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const avg = sorted.reduce((s, x) => s + x, 0) / sorted.length;
  return {
    measured: sorted.length,
    avgSec: Math.round(avg),
    medianSec: Math.round(median),
  };
}

/**
 * Performance cuisine sur la plage : temps de préparation
 * (preparingStartedAt → readyAt) et d'attente (createdAt → preparingStartedAt).
 * Une durée n'est comptée que si ses deux bornes existent et que le delta est
 * ≥ 0 (garde contre les horodatages incohérents). Commandes CANCELLED exclues.
 */
export async function getKitchenPerformance(
  from: Date,
  to: Date
): Promise<KitchenStats> {
  const rows = await prisma.order.findMany({
    where: { dailyDate: { gte: from, lte: to }, status: { not: 'CANCELLED' } },
    select: {
      dailyDate: true,
      createdAt: true,
      preparingStartedAt: true,
      readyAt: true,
    },
  });

  const prepDurations: number[] = [];
  const waitDurations: number[] = [];
  const prepByDay = new Map<string, number[]>();

  for (const r of rows) {
    if (r.preparingStartedAt && r.readyAt) {
      const sec = (r.readyAt.getTime() - r.preparingStartedAt.getTime()) / 1000;
      if (sec >= 0) {
        prepDurations.push(sec);
        const key = formatLocalDateOnly(r.dailyDate);
        const list = prepByDay.get(key) ?? [];
        list.push(sec);
        prepByDay.set(key, list);
      }
    }
    if (r.preparingStartedAt) {
      const sec =
        (r.preparingStartedAt.getTime() - r.createdAt.getTime()) / 1000;
      if (sec >= 0) waitDurations.push(sec);
    }
  }

  const byDay: KitchenStats['byDay'] = [];
  const cursor = new Date(from.getTime());
  while (cursor.getTime() <= to.getTime()) {
    const key = formatLocalDateOnly(cursor);
    const durations = prepByDay.get(key);
    byDay.push({
      date: key,
      avgPrepSec: durations
        ? Math.round(durations.reduce((s, x) => s + x, 0) / durations.length)
        : null,
      measured: durations?.length ?? 0,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return {
    from,
    to,
    prep: summarize(prepDurations),
    wait: summarize(waitDurations),
    byDay,
  };
}
