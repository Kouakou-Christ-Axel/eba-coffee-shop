// prisma/backfill-cloudinary-uploads.ts
//
// Backfill des médias déjà stockés localement (`/uploads/...`) vers
// Cloudinary : lit chaque fichier existant sur disque, l'uploade, puis met à
// jour l'URL en base pour les 7 familles concernées (produits, sondages,
// suggestions, dépenses, investissements, preuves de paiement).
//
//   pnpm db:backfill-cloudinary-uploads [--dry-run]
//
// Idempotent : seules les lignes dont l'URL commence encore par `/uploads/`
// sont sélectionnées — une ligne déjà migrée n'est plus jamais reprise, un
// re-run après échec partiel est donc sûr. Les fichiers locaux ne sont
// JAMAIS supprimés (le pipeline local reste un repli lecture seule).
//
// --dry-run : uploade réellement vers Cloudinary (pour détecter les échecs
// réels côté Cloudinary) mais n'écrit rien en base.

import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { uploadsBaseDir } from '@/lib/uploads';
import { uploadBufferToCloudinary } from '@/lib/cloudinary';
import type { UploadSubdir } from '@/lib/uploads';

type FailedRow = { model: string; id: string; oldUrl: string; error: string };

export type BackfillReport = {
  totalCandidates: number;
  migrated: number;
  failed: FailedRow[];
};

/**
 * Migre une famille de lignes déjà sélectionnées (id + ancienne URL locale)
 * vers Cloudinary. Erreur isolée par ligne (lecture disque, upload
 * Cloudinary, écriture DB) : n'interrompt jamais le run entier.
 */
async function migrateModel(
  label: string,
  subdir: UploadSubdir,
  rows: Array<{ id: string; url: string }>,
  updateUrl: (id: string, url: string) => Promise<unknown>,
  dryRun: boolean,
  report: BackfillReport
): Promise<void> {
  for (const row of rows) {
    report.totalCandidates += 1;
    try {
      const relativePath = row.url.replace(/^\/uploads\//, '');
      const buffer = await readFile(join(uploadsBaseDir(), relativePath));
      const secureUrl = await uploadBufferToCloudinary(buffer, subdir);

      if (dryRun) {
        console.log(
          `[DRY RUN] ${label}#${row.id} : ${row.url} -> ${secureUrl}`
        );
        continue;
      }

      await updateUrl(row.id, secureUrl);
      report.migrated += 1;
      console.log(`${label}#${row.id} migré -> ${secureUrl}`);
    } catch (err) {
      report.failed.push({
        model: label,
        id: row.id,
        oldUrl: row.url,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export async function backfillCloudinaryUploads(
  prisma: PrismaClient,
  { dryRun = false }: { dryRun?: boolean } = {}
): Promise<BackfillReport> {
  const report: BackfillReport = {
    totalCandidates: 0,
    migrated: 0,
    failed: [],
  };

  const products = await prisma.product.findMany({
    where: { imageUrl: { startsWith: '/uploads/' } },
    select: { id: true, imageUrl: true },
  });
  await migrateModel(
    'Product',
    'products',
    products.map((p) => ({ id: p.id, url: p.imageUrl! })),
    (id, url) =>
      prisma.product.update({ where: { id }, data: { imageUrl: url } }),
    dryRun,
    report
  );

  const polls = await prisma.poll.findMany({
    where: { imageUrl: { startsWith: '/uploads/' } },
    select: { id: true, imageUrl: true },
  });
  await migrateModel(
    'Poll',
    'polls',
    polls.map((p) => ({ id: p.id, url: p.imageUrl! })),
    (id, url) => prisma.poll.update({ where: { id }, data: { imageUrl: url } }),
    dryRun,
    report
  );

  const pollOptions = await prisma.pollOption.findMany({
    where: { imageUrl: { startsWith: '/uploads/' } },
    select: { id: true, imageUrl: true },
  });
  await migrateModel(
    'PollOption',
    'poll-options',
    pollOptions.map((o) => ({ id: o.id, url: o.imageUrl! })),
    (id, url) =>
      prisma.pollOption.update({ where: { id }, data: { imageUrl: url } }),
    dryRun,
    report
  );

  const pollSuggestions = await prisma.pollSuggestion.findMany({
    where: { imageUrl: { startsWith: '/uploads/' } },
    select: { id: true, imageUrl: true },
  });
  await migrateModel(
    'PollSuggestion',
    'poll-options',
    pollSuggestions.map((s) => ({ id: s.id, url: s.imageUrl! })),
    (id, url) =>
      prisma.pollSuggestion.update({ where: { id }, data: { imageUrl: url } }),
    dryRun,
    report
  );

  const expenses = await prisma.expense.findMany({
    where: { receiptUrl: { startsWith: '/uploads/' } },
    select: { id: true, receiptUrl: true },
  });
  await migrateModel(
    'Expense',
    'receipts',
    expenses.map((e) => ({ id: e.id, url: e.receiptUrl! })),
    (id, url) =>
      prisma.expense.update({ where: { id }, data: { receiptUrl: url } }),
    dryRun,
    report
  );

  const investments = await prisma.investment.findMany({
    where: { documentUrl: { startsWith: '/uploads/' } },
    select: { id: true, documentUrl: true },
  });
  await migrateModel(
    'Investment',
    'receipts',
    investments.map((i) => ({ id: i.id, url: i.documentUrl! })),
    (id, url) =>
      prisma.investment.update({ where: { id }, data: { documentUrl: url } }),
    dryRun,
    report
  );

  const orders = await prisma.order.findMany({
    where: { paymentProofUrl: { startsWith: '/uploads/' } },
    select: { id: true, paymentProofUrl: true },
  });
  await migrateModel(
    'Order',
    'payment-proofs',
    orders.map((o) => ({ id: o.id, url: o.paymentProofUrl! })),
    (id, url) =>
      prisma.order.update({ where: { id }, data: { paymentProofUrl: url } }),
    dryRun,
    report
  );

  return report;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    const report = await backfillCloudinaryUploads(prisma, { dryRun });
    console.log(
      `\nBackfill Cloudinary ${dryRun ? '(dry-run) ' : ''}terminé : ` +
        `${report.migrated}/${report.totalCandidates} ligne(s) migrée(s).`
    );
    if (report.failed.length > 0) {
      console.error(`${report.failed.length} échec(s) :`);
      for (const f of report.failed) {
        console.error(`  - ${f.model}#${f.id} (${f.oldUrl}) : ${f.error}`);
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
