import { Suspense } from 'react';
import { type SearchParams } from 'nuqs/server';
import { requireRoleOrAnalyst } from '@/lib/auth-helpers';
import { CustomerSearch } from './customer-search';
import { CustomerFormSheet } from './customer-form';
import { loadClientsSearchParams } from './search-params';
import { SummaryCards, SummaryCardsSkeleton } from './summary-cards';
import {
  CustomersSection,
  CustomersSectionSkeleton,
} from './customers-section';

export const dynamic = 'force-dynamic';

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireRoleOrAnalyst(['ADMIN']);
  // Même définition de paramètres que le client (search-params.ts) : une page
  // « abc » ou un tri inconnu retombe sur le défaut au lieu de partir en base.
  const filters = await loadClientsSearchParams(searchParams);

  // La page n'attend plus aucune lecture : chaque zone (tuiles, tableau) se
  // charge dans son propre `Suspense`, l'en-tête et la recherche restent
  // immédiatement utilisables.
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-bold">Clients</h1>
        <div className="flex flex-wrap items-center gap-2">
          <CustomerSearch />
          <CustomerFormSheet mode="create" />
        </div>
      </div>

      <Suspense fallback={<SummaryCardsSkeleton />}>
        <SummaryCards />
      </Suspense>

      <Suspense fallback={<CustomersSectionSkeleton />}>
        <CustomersSection filters={filters} />
      </Suspense>
    </div>
  );
}
