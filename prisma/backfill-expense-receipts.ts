// prisma/backfill-expense-receipts.ts
//
// Backfill rétroactif des numéros de reçu de dépense (DEP-YYYY-MM-NNNN) pour les
// dépenses déjà en base. Utile quand le déploiement passe par `db push` (qui
// n'exécute pas le SQL de migration) : les colonnes sont ajoutées NULL, ce
// script les renseigne.
//
//   pnpm db:backfill-expense-receipts
//
// Idempotent : ne touche QUE les dépenses sans numéro (receiptNo NULL) et
// continue la séquence du mois après le plus grand numéro déjà attribué. Ordre
// chronologique : date ASC, createdAt ASC, id ASC (cohérent avec la migration).

import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  receiptPeriodFromDate,
  formatReceiptNo,
} from '@/lib/expense-numbering';

async function backfill(prisma: PrismaClient) {
  const expenses = await prisma.expense.findMany({
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      date: true,
      receiptNo: true,
      receiptPeriod: true,
      receiptSeq: true,
    },
  });

  // Plus grande séquence déjà attribuée par mois (pour continuer sans collision).
  const maxSeqByPeriod = new Map<string, number>();
  for (const e of expenses) {
    if (e.receiptPeriod && e.receiptSeq != null) {
      maxSeqByPeriod.set(
        e.receiptPeriod,
        Math.max(maxSeqByPeriod.get(e.receiptPeriod) ?? 0, e.receiptSeq)
      );
    }
  }

  let updated = 0;
  for (const e of expenses) {
    if (e.receiptNo) continue; // déjà numérotée
    const period = receiptPeriodFromDate(e.date);
    const seq = (maxSeqByPeriod.get(period) ?? 0) + 1;
    maxSeqByPeriod.set(period, seq);
    await prisma.expense.update({
      where: { id: e.id },
      data: {
        receiptPeriod: period,
        receiptSeq: seq,
        receiptNo: formatReceiptNo(period, seq),
      },
    });
    updated++;
  }

  console.log(
    `Backfill numéros de reçu terminé : ${updated} dépense(s) numérotée(s) ` +
      `sur ${expenses.length} au total.`
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
