import prisma from '@/lib/prisma';

export type OptionStockRow = {
  id: string;
  optionName: string;
  price: number;
  stockQuantity: number | null;
  groupName: string;
  isGlobal: boolean;
  productId: string | null;
  productName: string | null;
  categoryName: string | null;
};

export async function getAllOptionStock(): Promise<OptionStockRow[]> {
  const options = await prisma.supplementOption.findMany({
    where: { stockQuantity: { not: null } },
    include: {
      group: {
        include: {
          product: { include: { category: true } },
        },
      },
    },
  });

  return options
    .map((o) => ({
      id: o.id,
      optionName: o.name,
      price: o.price,
      stockQuantity: o.stockQuantity,
      groupName: o.group.name,
      isGlobal: o.group.isGlobal,
      productId: o.group.product?.id ?? null,
      productName: o.group.product?.name ?? null,
      categoryName: o.group.product?.category.name ?? null,
    }))
    .sort((a, b) => (a.stockQuantity ?? 0) - (b.stockQuantity ?? 0));
}
