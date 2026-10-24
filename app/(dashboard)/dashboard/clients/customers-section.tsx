// Tableau des clients + compteur + pagination. Composant serveur autonome (son
// propre `Suspense` dans la page) : il ne dépend que des paramètres d'URL, pas
// des tuiles de synthèse. Les stats par client, elles, arrivent encore à part
// (cf. `use-customer-stats.ts`).

import { listCustomers } from '@/lib/customers';
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
  const { customers, total, pageSize } = await listCustomers({
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
      <CustomersTable customers={customers} />
      {totalPages > 1 && <Pagination totalPages={totalPages} />}
    </div>
  );
}

export function CustomersSectionSkeleton() {
  return <TableSkeleton rows={10} withToolbar={false} />;
}
