// Tableau des clients + compteur + pagination. Composant serveur autonome (son
// propre `Suspense` dans la page) : il ne dépend que des paramètres d'URL, pas
// des tuiles de synthèse. Les stats par client sont une requête indépendante,
// lancée en même temps que la liste et streamée (cf. `use-streamed-stats.ts`).

import { getPageStats, listCustomers } from '@/lib/customers';
import { Pagination } from '@/components/(dashboard)/pagination';
import { TableSkeleton } from '@/components/(dashboard)/skeletons';
import { CustomersTable } from './customers-table';
import type { loadClientsSearchParams } from './search-params';

export async function CustomersSection({
  filters,
}: {
  filters: Awaited<ReturnType<typeof loadClientsSearchParams>>;
}) {
  const query = {
    search: filters.search?.trim() || undefined,
    page: filters.page,
    sort: filters.sort ?? undefined,
    dir: filters.dir,
  };
  // Deux requêtes indépendantes, lancées EN MÊME TEMPS avec le même filtre. La
  // page n'attend que la liste ; la promesse de stats part vers le navigateur.
  const stats = getPageStats(query);
  stats.catch((err) => console.error('[clients] stats', err));
  const { customers, total, pageSize } = await listCustomers(query);
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
