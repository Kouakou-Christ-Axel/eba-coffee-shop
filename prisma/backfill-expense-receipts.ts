// prisma/backfill-expense-receipts.ts
//
// Backfill rétroactif des numéros de reçu de dépense (DEP-YYYY-MM-NNNN) pour les
// dépenses déjà en base — variante CLI de la même logique que le bouton
// « Numéroter les dépenses sans reçu » du dashboard.
//
//   pnpm db:backfill-expense-receipts
//
// Idempotent (cf. `backfillExpenseReceipts`). À privilégier : le bouton du
// dashboard (réservé admin), qui ne nécessite ni accès shell ni env.

import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { backfillExpenseReceipts } from '@/lib/expense-mutations';

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    const { updated, total } = await backfillExpenseReceipts(prisma);
    console.log(
      `Backfill numéros de reçu terminé : ${updated} dépense(s) numérotée(s) ` +
        `sur ${total} au total.`
    );
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
