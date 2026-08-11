import prisma from '@/lib/prisma';
import { getMenuSettings } from '@/lib/menu-settings-db';
import { listProductSchedules } from '@/lib/menu';
import { CategoryForm } from './category-form';
import { CategoriesTable, type CategoryRow } from './categories-table';
import { MenuPdfField } from './menu-pdf-field';

// Page d'administration : données live, jamais prérendue. Même convention que
// les autres pages du dashboard (commandes, clients, caisse, inventaire…).
export const dynamic = 'force-dynamic';

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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Menu — Catégories</h1>

      <MenuPdfField initialUrl={menuSettings.menuPdfUrl} />

      <div className="rounded-lg border p-4">
        <h2 className="mb-3 text-sm font-semibold">
          Ajouter une nouvelle catégorie
        </h2>
        <CategoryForm schedules={schedules} />
      </div>

      <CategoriesTable categories={rows} schedules={schedules} />
    </div>
  );
}
