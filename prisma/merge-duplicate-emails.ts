// prisma/merge-duplicate-emails.ts
//
// Fusionne les comptes User en double qui ne diffèrent que par la casse de
// l'email (ex. "Foo@Bar.com" vs "foo@bar.com") — doublons créés avant
// l'introduction de la colonne `email` en `citext` (comparaison insensible à
// la casse). À lancer UNE fois AVANT `pnpm db:push` : la contrainte unique
// `citext` rejetterait le push s'il reste des doublons de casse en base.
//
//   pnpm db:merge-duplicate-emails
//
// Idempotent : sans doublon restant, ne fait rien. Pour chaque groupe de
// comptes partageant le même email (casse ignorée, espaces ignorés) :
//   - le compte "survivant" est choisi par rôle le plus privilégié, puis par
//     ancienneté (le plus vieux compte) ;
//   - son rôle est relevé au rôle le plus privilégié du groupe, son
//     `emailVerified` passe à true si au moins un doublon l'avait ;
//   - toutes les lignes qui référencent un doublon (sessions, comptes OAuth,
//     commandes/dépenses/etc. créées par ce compte…) sont réassignées au
//     survivant ;
//   - les doublons sont ensuite supprimés ;
//   - l'email du survivant est normalisé (trim + minuscule).

import { fileURLToPath } from 'node:url';
import { PrismaClient, Prisma, type UserRole } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

type DbClient = PrismaClient | Prisma.TransactionClient;

// Du plus privilégié au moins privilégié — sert à choisir le rôle du compte
// fusionné quand les doublons n'ont pas le même rôle.
const ROLE_PRIORITY: UserRole[] = [
  'ADMIN',
  'MANAGER',
  'ASSISTANT_MANAGER',
  'COMPTABLE',
  'CASHIER',
  'KITCHEN',
  'ANALYSTE',
  'USER',
];

function higherRole(a: UserRole, b: UserRole): UserRole {
  return ROLE_PRIORITY.indexOf(a) <= ROLE_PRIORITY.indexOf(b) ? a : b;
}

// Tables (et colonne FK) qui référencent `User.id` — doivent toutes être
// réassignées du doublon vers le survivant avant de pouvoir le supprimer.
// `session`/`account`/`push_subscription` sont en cascade sur User mais on les
// réassigne aussi : on veut les CONSERVER (sessions actives, abonnements push)
// plutôt que les perdre en même temps que le doublon supprimé.
async function reassignUserReferences(
  prisma: DbClient,
  fromId: string,
  toId: string
) {
  await prisma.session.updateMany({
    where: { userId: fromId },
    data: { userId: toId },
  });
  await prisma.account.updateMany({
    where: { userId: fromId },
    data: { userId: toId },
  });
  await prisma.pushSubscription.updateMany({
    where: { userId: fromId },
    data: { userId: toId },
  });
  await prisma.order.updateMany({
    where: { createdById: fromId },
    data: { createdById: toId },
  });
  await prisma.orderPayment.updateMany({
    where: { createdById: fromId },
    data: { createdById: toId },
  });
  await prisma.expense.updateMany({
    where: { createdById: fromId },
    data: { createdById: toId },
  });
  await prisma.investment.updateMany({
    where: { createdById: fromId },
    data: { createdById: toId },
  });
  await prisma.revenueAdjustment.updateMany({
    where: { createdById: fromId },
    data: { createdById: toId },
  });
  await prisma.cashClosing.updateMany({
    where: { closedById: fromId },
    data: { closedById: toId },
  });
  await prisma.inventoryPurchase.updateMany({
    where: { createdById: fromId },
    data: { createdById: toId },
  });
  await prisma.inventoryCount.updateMany({
    where: { createdById: fromId },
    data: { createdById: toId },
  });
  await prisma.inventoryRestockBatch.updateMany({
    where: { createdById: fromId },
    data: { createdById: toId },
  });
  await prisma.poll.updateMany({
    where: { createdById: fromId },
    data: { createdById: toId },
  });
  await prisma.tiktokVideo.updateMany({
    where: { createdById: fromId },
    data: { createdById: toId },
  });
  await prisma.pollSuggestion.updateMany({
    where: { moderatedById: fromId },
    data: { moderatedById: toId },
  });
  await prisma.purchaseDraft.updateMany({
    where: { createdById: fromId },
    data: { createdById: toId },
  });
}

export async function mergeDuplicates(prisma: PrismaClient) {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      emailVerified: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const groups = new Map<string, typeof users>();
  for (const user of users) {
    const key = user.email.trim().toLowerCase();
    const group = groups.get(key);
    if (group) {
      group.push(user);
    } else {
      groups.set(key, [user]);
    }
  }

  let mergedGroups = 0;
  let mergedAccounts = 0;

  for (const [normalizedEmail, group] of groups) {
    if (group.length < 2) continue;

    // Le plus ancien compte est le survivant par défaut (comportement le
    // plus prévisible pour l'historique) — sauf si un doublon plus récent a
    // un rôle strictement plus privilégié, auquel cas c'est probablement le
    // compte réellement utilisé par le staff.
    let primary = group[0];
    for (const candidate of group.slice(1)) {
      if (
        ROLE_PRIORITY.indexOf(candidate.role) <
        ROLE_PRIORITY.indexOf(primary.role)
      ) {
        primary = candidate;
      }
    }

    const duplicates = group.filter((u) => u.id !== primary.id);
    const mergedRole = group.reduce(
      (role, u) => higherRole(role, u.role),
      primary.role
    );
    const mergedEmailVerified = group.some((u) => u.emailVerified);

    await prisma.$transaction(async (tx) => {
      for (const duplicate of duplicates) {
        await reassignUserReferences(tx, duplicate.id, primary.id);
      }
      // Doublons supprimés AVANT la mise à jour du survivant : son email
      // normalisé peut être identique à celui d'un doublon, ce qui violerait
      // la contrainte unique tant que ce dernier existe.
      await tx.user.deleteMany({
        where: { id: { in: duplicates.map((d) => d.id) } },
      });
      // `select` obligatoire : sans lui Prisma relit TOUTES les colonnes du
      // modèle, y compris celles que `db:push` n'a pas encore créées (ex.
      // `disabledAt`) — le script tourne justement AVANT `db:push`.
      await tx.user.update({
        where: { id: primary.id },
        data: {
          email: normalizedEmail,
          role: mergedRole,
          emailVerified: mergedEmailVerified,
        },
        select: { id: true },
      });
    });

    mergedGroups++;
    mergedAccounts += duplicates.length;
    console.log(
      `Fusionné : ${group.length} compte(s) → 1 (${normalizedEmail}), conservé id=${primary.id}, rôle=${mergedRole}`
    );
  }

  console.log(
    `Terminé : ${mergedGroups} groupe(s) de doublons fusionné(s), ${mergedAccounts} compte(s) en double supprimé(s).`
  );
}

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    await mergeDuplicates(prisma);
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
