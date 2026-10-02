// prisma/merge-duplicate-emails.test.ts
//
// Ce script tourne AVANT `db:push` : la base n'a donc pas encore les colonnes
// ajoutées au schéma depuis (ex. `User.disabledAt`). Toute opération sur User
// qui renvoie la ligne entière relit ces colonnes → P2022 « column does not
// exist » et le déploiement reste bloqué (doublons non fusionnés → db:push
// refuse la contrainte unique citext).

import { describe, expect, it, vi } from 'vitest';

vi.mock('@/generated/prisma/client', () => ({
  PrismaClient: vi.fn(),
  Prisma: {},
}));
vi.mock('@prisma/adapter-pg', () => ({ PrismaPg: vi.fn() }));

import { mergeDuplicates } from './merge-duplicate-emails';

const noop = () => vi.fn().mockResolvedValue({ count: 0 });

function makeClient() {
  const order: string[] = [];
  const tx = {
    user: {
      update: vi.fn().mockImplementation(async () => order.push('update')),
      deleteMany: vi.fn().mockImplementation(async () => order.push('delete')),
    },
  } as Record<string, unknown>;
  for (const model of [
    'session',
    'account',
    'pushSubscription',
    'order',
    'orderPayment',
    'expense',
    'investment',
    'inventoryRestockBatch',
    'poll',
    'tiktokVideo',
    'pollSuggestion',
    'purchaseDraft',
  ]) {
    tx[model] = { updateMany: noop() };
  }
  // Le script ne réassigne que les tables qu'il connaît : on complète via Proxy.
  const txProxy = new Proxy(tx, {
    get: (t, k: string) => t[k] ?? { updateMany: noop() },
  });
  const prisma = {
    user: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'old',
          email: 'Foo@Bar.com',
          role: 'USER',
          emailVerified: false,
          createdAt: new Date('2026-01-01'),
        },
        {
          id: 'new',
          email: 'foo@bar.com',
          role: 'ADMIN',
          emailVerified: true,
          createdAt: new Date('2026-02-01'),
        },
      ]),
    },
    $transaction: vi.fn((fn: (t: unknown) => unknown) => fn(txProxy)),
  };
  return { prisma, tx, order };
}

describe('mergeDuplicates', () => {
  it('ne relit pas toutes les colonnes de User (select explicite)', async () => {
    const { prisma, tx } = makeClient();
    await mergeDuplicates(prisma as never);

    const update = (tx.user as { update: ReturnType<typeof vi.fn> }).update;
    expect(update.mock.calls[0][0].select).toEqual({ id: true });
  });

  it('supprime les doublons avant de normaliser l’email du survivant', async () => {
    const { prisma, order } = makeClient();
    await mergeDuplicates(prisma as never);

    expect(order).toEqual(['delete', 'update']);
  });
});
