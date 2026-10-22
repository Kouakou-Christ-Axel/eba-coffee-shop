import prisma from '@/lib/prisma';
import { triggerRestockAlerts } from '@/lib/restock-alerts';
import { launchDueScheduledOrders } from '@/lib/orders/auto-launch';

/**
 * Le stock vient de changer : les programmées du jour le réservent d'abord
 * (par heure de retrait), puis seulement le comptoir vend le reste. Sans ça,
 * une fournée de midi est vendue en entier et la programmée oubliée exige une
 * fournée de plus. Fire-and-forget : ne bloque ni n'échoue le réappro.
 */
function afterStockChange() {
  triggerRestockAlerts();
  void launchDueScheduledOrders(new Date(), { force: true }).catch(() => {});
}

export async function setProductStock(id: string, quantity: number | null) {
  const p = await prisma.product.findUnique({ where: { id } });
  if (!p) throw new Error('Produit introuvable');
  const updated = await prisma.product.update({
    where: { id },
    data: { stockQuantity: quantity },
  });
  afterStockChange();
  return updated;
}

export async function setOptionStock(id: string, quantity: number | null) {
  const o = await prisma.supplementOption.findUnique({ where: { id } });
  if (!o) throw new Error('Option introuvable');
  const updated = await prisma.supplementOption.update({
    where: { id },
    data: { stockQuantity: quantity },
  });
  afterStockChange();
  return updated;
}

export async function restockProduct(id: string, delta: number) {
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
  afterStockChange();
  return updated;
}

export async function restockOption(id: string, delta: number) {
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
  afterStockChange();
  return updated;
}

export async function setOptionStockByRef(input: {
  productId: string;
  groupName: string;
  optionName: string;
  stock: number;
}): Promise<{ stockQuantity: number | null }> {
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
  afterStockChange();
  return { stockQuantity: updated.stockQuantity };
}

export async function setProductStockById(input: {
  productId: string;
  stock: number;
}): Promise<{ stockQuantity: number | null }> {
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
  afterStockChange();
  return { stockQuantity: updated.stockQuantity };
}
