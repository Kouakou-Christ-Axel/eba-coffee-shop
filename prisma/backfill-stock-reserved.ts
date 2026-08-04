// prisma/backfill-stock-reserved.ts
//
// Backfill OBLIGATOIRE de `Order.stockReservedAt` (verrou d'idempotence de la
// réservation de stock). La colonne arrive à null sur TOUTES les lignes
// existantes, alors que les commandes historiques ont DÉJÀ décrémenté leur
// stock sous l'ancienne règle (« le stock est décrémenté à l'encaissement »).
// Sans ce backfill, la première transition CANCELLED → PREPARING (ou
// PREPARING → NEW → PREPARING) sur une commande ancienne décrémenterait le
// stock une SECONDE fois. Ce n'est donc pas un confort : c'est un prérequis de
// correction.
//
// FILET DE SÉCURITÉ, pas l'étape nominale : ce backfill est DÉJÀ exécuté par la
// migration `20260804120000_add_stock_reservation_and_trusted_customers`, dans
// la même transaction que l'ajout de la colonne — précisément pour qu'il ne
// puisse pas être oublié entre la migration et le déploiement du code. Ce script
// reste utile pour rattraper une base créée via `prisma db push` (qui applique le
// schéma sans jouer les migrations) ou pour vérifier l'état après coup.
//
// Idempotent : le garde `stockReservedAt IS NULL` fait de toute relance un
// no-op (0 ligne mise à jour).
//
// Choix de l'horodatage (COALESCE, du plus vrai au dernier recours) :
//   - `preparingStartedAt` : l'entrée en cuisine est l'instant de réservation
//     le plus fidèle ;
//   - `paidAt` : couvre les commandes payées sans entrée en cuisine enregistrée ;
//   - `createdAt` : dernier recours, toujours renseigné.

import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

async function backfill(prisma: PrismaClient) {
  // Commandes réputées avoir déjà décrémenté leur stock : payées, ou entrées
  // en cuisine à un moment (PREPARING/READY/COMPLETED). Les commandes NEW non
  // payées et les CANCELLED jamais parties en cuisine restent à null : leur
  // stock n'a jamais été réservé.
  const updated = await prisma.$executeRaw`
    UPDATE "order"
    SET "stockReservedAt" = COALESCE("preparingStartedAt", "paidAt", "createdAt")
    WHERE "stockReservedAt" IS NULL
      AND ("isPaid" = true OR "status" IN ('PREPARING', 'READY', 'COMPLETED'));
  `;

  const remaining = await prisma.order.count({
    where: { stockReservedAt: null },
  });

  console.log(
    `Backfill réservation de stock terminé : ${updated} commande(s) horodatée(s), ` +
      `${remaining} commande(s) laissée(s) à null (stock jamais réservé).`
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
