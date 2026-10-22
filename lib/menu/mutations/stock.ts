import prisma from '@/lib/prisma';
import { triggerRestockAlerts } from '@/lib/restock-alerts';
import { reserveForScheduledOrdersSafe } from '@/lib/orders/stock-holds';

/**
 * Options d'une mise à jour de stock. `reserveForScheduled: false` garde le stock
 * au comptoir (cas « cette fournée n'est pas pour les programmées ») ; par défaut,
 * les programmées payées du jour prennent leur part, par heure de retrait.
 */
export type StockWriteOptions = { reserveForScheduled?: boolean };

async function afterStockChange(opts?: StockWriteOptions) {
  triggerRestockAlerts();
  if (opts?.reserveForScheduled !== false) {
    await reserveForScheduledOrdersSafe();
  }
}

export async function setProductStock(
  id: string,
  quantity: number | null,
  opts?: StockWriteOptions
) {
  const p = await prisma.product.findUnique({ where: { id } });
  if (!p) throw new Error('Produit introuvable');
  const updated = await prisma.product.update({
    where: { id },
    data: { stockQuantity: quantity },
  });
  await afterStockChange(opts);
  return updated;
}

export async function setOptionStock(
  id: string,
  quantity: number | null,
  opts?: StockWriteOptions
) {
  const o = await prisma.supplementOption.findUnique({ where: { id } });
  if (!o) throw new Error('Option introuvable');
  const updated = await prisma.supplementOption.update({
    where: { id },
    data: { stockQuantity: quantity },
  });
  await afterStockChange(opts);
  return updated;
}

export async function restockProduct(
  id: string,
  delta: number,
  opts?: StockWriteOptions
) {
  const p = await prisma.product.findUnique({
    where: { id },
    select: { stockQuantity: true },
  });
  if (!p) throw new Error('Produit introuvable');
  if (p.stockQuantity === null) {
    throw new Error(
      'Produit à stock illimité : impossible de réapprovisionner'
    );
  }
  const updated = await prisma.product.update({
    where: { id },
    data: { stockQuantity: { increment: delta } },
  });
  await afterStockChange(opts);
  return updated;
}

export async function restockOption(
  id: string,
  delta: number,
  opts?: StockWriteOptions
) {
  const o = await prisma.supplementOption.findUnique({
    where: { id },
    select: { stockQuantity: true },
  });
  if (!o) throw new Error('Option introuvable');
  if (o.stockQuantity === null) {
    throw new Error('Option à stock illimité : impossible de réapprovisionner');
  }
  const updated = await prisma.supplementOption.update({
    where: { id },
    data: { stockQuantity: { increment: delta } },
  });
  await afterStockChange(opts);
  return updated;
}

export async function setOptionStockByRef(
  input: {
    productId: string;
    groupName: string;
    optionName: string;
    stock: number;
  },
  opts?: StockWriteOptions
): Promise<{ stockQuantity: number | null }> {
  const option = await prisma.supplementOption.findFirst({
    where: {
      name: input.optionName,
      // Groupe propre au produit OU global (« Extras »), même résolution que
      // `decrementStockForOrderItems` (lib/order-mutations.ts).
      group: {
        name: input.groupName,
        OR: [{ productId: input.productId }, { isGlobal: true }],
      },
    },
    orderBy: { id: 'asc' },
    select: { id: true },
  });
  if (!option) throw new Error('Option introuvable');

  const updated = await prisma.supplementOption.update({
    where: { id: option.id },
    data: { stockQuantity: input.stock },
    select: { stockQuantity: true },
  });
  await afterStockChange(opts);
  return { stockQuantity: updated.stockQuantity };
}

export async function setProductStockById(
  input: {
    productId: string;
    stock: number;
  },
  opts?: StockWriteOptions
): Promise<{ stockQuantity: number | null }> {
  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    select: { id: true },
  });
  if (!product) throw new Error('Produit introuvable');

  const updated = await prisma.product.update({
    where: { id: input.productId },
    data: { stockQuantity: input.stock },
    select: { stockQuantity: true },
  });
  await afterStockChange(opts);
  return { stockQuantity: updated.stockQuantity };
}
