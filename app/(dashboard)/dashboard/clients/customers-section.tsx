// Tableau des clients + compteur + pagination. Composant serveur autonome (son
// propre `Suspense` dans la page) : il ne dépend que des paramètres d'URL, pas
// des tuiles de synthèse. Les stats par client arrivent en streaming, derrière
// leur propre `Suspense` par cellule (cf. `stat-cell.tsx`).

import { listCustomersWithDeferredStats } from '@/lib/customers';
import { Pagination } from '@/components/(dashboard)/pagination';
import { TableSkeleton } from '@/components/(dashboard)/skeletons';
import { CustomersTable } from './customers-table';
import type { loadClientsSearchParams } from './search-params';

export async function CustomersSection({
  filters,
}: {
  filters: Awaited<ReturnType<typeof loadClientsSearchParams>>;
}) {
  const page = Math.max(1, filters.page);
  const search = filters.search?.trim() || undefined;
  // Fiches et stats partent EN MÊME TEMPS (dès que la page de ids est connue) ;
  // le tableau s'affiche avec les fiches, les stats arrivent en streaming.
  const { customers, total, pageSize, stats } =
    await listCustomersWithDeferredStats({
      search,
      page,
      sort: filters.sort ?? undefined,
      dir: filters.dir,
    });
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {total} client{total > 1 ? 's' : ''} identifié
        {total > 1 ? 's' : ''} par téléphone.
      </p>
      <CustomersTable customers={customers} stats={stats} />
      {totalPages > 1 && <Pagination totalPages={totalPages} />}
    </div>
  );
}

export function CustomersSectionSkeleton() {
  return <TableSkeleton rows={10} withToolbar={false} />;
}
