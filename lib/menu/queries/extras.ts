import prisma from '@/lib/prisma';

export type GlobalExtraOption = {
  id: string;
  name: string;
  price: number;
  available: boolean;
  stockQuantity: number | null;
};

export type GlobalExtraGroup = {
  id: string;
  name: string;
  type: 'single' | 'multiple' | 'quantity';
  required: boolean;
  available: boolean;
  sortOrder: number;
  minSelect: number | null;
  maxSelect: number | null;
  options: GlobalExtraOption[];
};

export async function getGlobalExtras(): Promise<GlobalExtraGroup[]> {
  const groups = await prisma.supplementGroup.findMany({
    where: { isGlobal: true },
    orderBy: { sortOrder: 'asc' },
    include: { options: { orderBy: { sortOrder: 'asc' } } },
  });

  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    type: g.type as 'single' | 'multiple' | 'quantity',
    required: g.required,
    available: g.available,
    sortOrder: g.sortOrder,
    minSelect: g.minSelect,
    maxSelect: g.maxSelect,
    options: g.options.map((o) => ({
      id: o.id,
      name: o.name,
      price: o.price,
      available: o.available,
      stockQuantity: o.stockQuantity,
    })),
  }));
}
