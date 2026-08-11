import Link from 'next/link';
import prisma from '@/lib/prisma';
import { Button } from '@/components/ui/button';
import { getMenuSettings } from '@/lib/menu-settings-db';
import { listProductSchedules } from '@/lib/menu';
import { CategoryForm } from './category-form';
import { CategoriesTable, type CategoryRow } from './categories-table';
import { MenuPdfField } from './menu-pdf-field';

export default async function MenuPage() {
  const [categories, menuSettings, schedules] = await Promise.all([
    prisma.menuCategory.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { products: { where: { deletedAt: null } } } },
        schedule: { select: { id: true, name: true } },
      },
    }),
    getMenuSettings(),
    listProductSchedules(),
  ]);

  const rows: CategoryRow[] = categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    available: cat.available,
    scheduleId: cat.scheduleId,
    scheduleName: cat.schedule?.name ?? null,
    advanceOrderDays: cat.advanceOrderDays,
    productCount: cat._count.products,
  }));

  const visibleCount = rows.filter((c) => c.available).length;
  const productTotal = rows.reduce((sum, c) => sum + c.productCount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Menu — Catégories</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} catégorie{rows.length > 1 ? 's' : ''} · {visibleCount}{' '}
            visible{visibleCount > 1 ? 's' : ''} sur la carte · {productTotal}{' '}
            produit{productTotal > 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/menu/plannings">Plannings récurrents</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/menu/stock-supplements">Stock par goût</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/menu/extras-globaux">Extras globaux</Link>
          </Button>
        </div>
      </div>

      <CategoryForm schedules={schedules} />

      <CategoriesTable categories={rows} schedules={schedules} />

      <MenuPdfField initialUrl={menuSettings.menuPdfUrl} />
    </div>
  );
}
