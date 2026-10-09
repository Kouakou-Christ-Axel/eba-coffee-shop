import { Prisma } from '@/generated/prisma/client';
import type { Tx } from './helpers';

export function rethrowUniqueSku(err: unknown): unknown {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002'
  ) {
    return new Error('Une référence (SKU) identique existe déjà.');
  }
  return err;
}

export function skuBase(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 12)
    .replace(/-+$/g, '');
  return base || 'REF';
}

export async function generateUniqueSku(tx: Tx, name: string): Promise<string> {
  const base = skuBase(name);
  for (let i = 1; i <= 999; i++) {
    const candidate = i === 1 ? base : `${base}-${i}`;
    const exists = await tx.inventoryItem.findUnique({
      where: { sku: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  // Repli improbable : suffixe aléatoire.
  return `${base}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}
