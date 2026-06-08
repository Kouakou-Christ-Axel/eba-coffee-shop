// prisma/backfill-loyalty.ts
//
// Backfill fidélité : calcule la CARTE EN COURS (nombre de tampons) de chaque
// client en rejouant ses commandes passées, sans créditer rétroactivement les
// récompenses des paliers déjà franchis (décision métier).
//
// À lancer APRÈS `db:backfill-customers` (les commandes doivent être rattachées) :
//   pnpm db:backfill-loyalty
//
// Idempotent : recalcule depuis zéro et ÉCRIT le résultat (set, pas +=). Ne crée
// ni récompense ni écriture de ledger.
//
// Règles appliquées (identiques au moteur live) : commande ≥ montant min,
// 1 tampon/jour/numéro (si activé), commandes annulées exclues, reset après une
// carte complète. Le flag `enabled` ne bloque PAS le calcul (on prépare la carte
// même si le programme sera activé juste après).

import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { loyaltySettingsFromRow } from '@/lib/loyalty-settings';
import { computeStampAward } from '@/lib/loyalty-compute';

async function backfill(prisma: PrismaClient) {
  const settings = loyaltySettingsFromRow(
    await prisma.loyaltySettings.findUnique({ where: { id: 'singleton' } })
  );

  const customers = await prisma.customer.findMany({ select: { id: true } });
  let updated = 0;

  for (const c of customers) {
    const orders = await prisma.order.findMany({
      where: { customerId: c.id, status: { not: 'CANCELLED' } },
      select: { total: true, dailyDate: true },
      orderBy: [{ dailyDate: 'asc' }, { createdAt: 'asc' }],
    });

    let count = 0;
    let lastDay: Date | null = null;
    for (const o of orders) {
      if (o.total < settings.minOrderAmount) continue;
      if (
        settings.oneStampPerDay &&
        lastDay &&
        lastDay.getTime() === o.dailyDate.getTime()
      ) {
        continue;
      }
      count = computeStampAward(count, settings).newStampCount;
      lastDay = o.dailyDate;
    }

    await prisma.customer.update({
      where: { id: c.id },
      data: { stampCount: count, lastStampDate: lastDay },
    });
    updated++;
  }

  console.log(
    `Backfill fidélité terminé : ${updated} client(s) recalculé(s) ` +
      `(carte de ${settings.stampsPerCard}, min ${settings.minOrderAmount} F).`
  );
}

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    await backfill(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

const isDirectRun =
  // @ts-expect-error -- propriété Bun-spécifique non typée
  import.meta.main === true ||
  (typeof process !== 'undefined' &&
    process.argv[1] === fileURLToPath(import.meta.url));

if (isDirectRun) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
