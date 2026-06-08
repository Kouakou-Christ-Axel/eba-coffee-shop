// prisma/backfill-customers.ts
//
// Backfill idempotent : crée les clients (Customer) à partir des téléphones des
// commandes existantes et rattache chaque commande (Order.customerId).
// À lancer UNE fois après la migration `add_customer` :
//   pnpm db:backfill-customers
//
// Idempotent : relançable sans dommage (upsert sur la clé téléphone, ne touche
// que les commandes encore non rattachées).

import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { customerPhoneKey } from '@/lib/phone';

async function backfill(prisma: PrismaClient) {
  const orders = await prisma.order.findMany({
    where: { customerId: null, customerPhone: { not: null } },
    select: { id: true, customerPhone: true, customerName: true },
    orderBy: { createdAt: 'asc' },
  });

  let linked = 0;
  for (const order of orders) {
    const key = customerPhoneKey(order.customerPhone);
    if (!key) continue;
    const name = order.customerName?.trim() || null;

    const customer = await prisma.customer.upsert({
      where: { phone: key },
      create: { phone: key, name },
      update: name ? { name } : {},
    });
    await prisma.order.update({
      where: { id: order.id },
      data: { customerId: customer.id },
    });
    linked++;
  }

  const customerCount = await prisma.customer.count();
  console.log(
    `Backfill terminé : ${linked} commande(s) rattachée(s), ${customerCount} client(s) au total.`
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
