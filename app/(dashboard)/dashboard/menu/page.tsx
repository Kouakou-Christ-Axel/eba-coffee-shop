import prisma from '@/lib/prisma';
import { listProductSchedules } from '@/lib/menu';
import { MenuCategoriesView } from './_components/menu-categories-view';
import { type CategoryRow } from './categories-table';

// Page d'administration : données live, jamais prérendue. Même convention que
// les autres pages du dashboard (commandes, clients, caisse, inventaire…).
export const dynamic = 'force-dynamic';

// La page s'ouvrait autrefois sur deux cartes — la carte PDF, puis le
// formulaire de création de catégorie — qui repoussaient la liste des
// catégories sous la ligne de flottaison. Aucune des deux ne sert à la tâche
// courante : la carte PDF a sa page (`./reglages`) et la création passe par un
// bouton. Reste ce qu'on vient vraiment voir ici.
export default async function MenuPage() {
  const [categories, schedules] = await Promise.all([
    prisma.menuCategory.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { products: { where: { deletedAt: null } } } },
        schedule: { select: { id: true, name: true } },
      },
    }),
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
      <MenuCategoriesView categories={rows} schedules={schedules} />
    </div>
  );
}
