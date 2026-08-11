import { notFound } from 'next/navigation';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import { Button } from '@/components/ui/button';
import { ProductsTable } from './products-table';
import { BackButton } from '@/components/(dashboard)/back-button';
import { getPendingDemand } from '@/lib/orders/pending-demand';
import { formatLocalDateOnly } from '@/lib/timezone';

export default async function CategoryProductsPage({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const { categoryId } = await params;

  const [category, pendingDemand] = await Promise.all([
    prisma.menuCategory.findUnique({
      where: { id: categoryId },
      include: {
        products: {
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            name: true,
            price: true,
            coutMatiere: true,
            coutEmballage: true,
            imageUrl: true,
            available: true,
            featured: true,
            featuredBadge: true,
            stockQuantity: true,
            unavailableUntil: true,
            schedule: { select: { name: true } },
            weeklySpecials: { select: { startDate: true, endDate: true } },
          },
        },
      },
    }),
    getPendingDemand(),
  ]);

  if (!category || category.deletedAt) notFound();

  const products = category.products.map((p) => ({
    ...p,
    scheduleName: p.schedule?.name ?? null,
    weeklySpecialPeriods: p.weeklySpecials.map((w) => ({
      startDate: formatLocalDateOnly(w.startDate),
      endDate: formatLocalDateOnly(w.endDate),
    })),
    pending: pendingDemand.products.get(p.id) ?? 0,
  }));

  const visibleCount = products.filter((p) => p.available).length;
  const outOfStockCount = products.filter((p) => p.stockQuantity === 0).length;

  return (
    <div className="space-y-6">
      <div>
        <BackButton
          fallbackHref="/dashboard/menu"
          label="Catégories"
          className="-ml-3 mb-2"
        />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{category.name}</h1>
            <p className="text-sm text-muted-foreground">
              {products.length} produit{products.length > 1 ? 's' : ''} ·{' '}
              {visibleCount} visible{visibleCount > 1 ? 's' : ''}
              {outOfStockCount > 0 && ` · ${outOfStockCount} épuisé(s)`}
              {!category.available && ' · catégorie masquée de la carte'}
            </p>
          </div>
          <Button asChild>
            <Link href={`/dashboard/menu/${categoryId}/produits/new`}>
              + Nouveau produit
            </Link>
          </Button>
        </div>
      </div>

      <ProductsTable categoryId={categoryId} products={products} />
    </div>
  );
}
