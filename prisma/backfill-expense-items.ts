// prisma/backfill-expense-items.ts
//
// Backfill rétroactif du détail par article (`ExpenseItem`) des dépenses déjà
// liées à des achats d'inventaire (créées par `batchRestock`) — donne
// instantanément l'historique de fréquence (« combien de fois a-t-on acheté la
// farine T45 ») pour tout ce qui passait par le stock.
//
//   pnpm db:backfill-expense-items          # applique
//   pnpm db:backfill-expense-items --dry    # simulation (aucune écriture)
//
// Idempotent (cf. `backfillExpenseItems`). Ne modifie JAMAIS le montant d'une
// dépense : en cas d'écart (montant édité après coup), la dépense est ignorée
// et rapportée pour un complément manuel.

import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { backfillExpenseItems } from '@/lib/expense-mutations';

async function main() {
  const dry = process.argv.includes('--dry');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    const { processed, itemsCreated, skippedMismatch } =
      await backfillExpenseItems(prisma, { dry });
    const prefix = dry ? '[simulation] ' : '';
    console.log(
      `${prefix}Backfill du détail des dépenses terminé : ${processed} ` +
        `dépense(s) détaillée(s), ${itemsCreated} ligne(s) créée(s).`
    );
    if (skippedMismatch.length > 0) {
      console.log(
        `${skippedMismatch.length} dépense(s) ignorée(s) (somme des achats ≠ montant) :`
      );
      for (const s of skippedMismatch) {
        console.log(
          `  - ${s.receiptNo ?? s.expenseId} : montant ${s.amount} F, ` +
            `achats ${s.purchasesSum} F`
        );
      }
    }
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
