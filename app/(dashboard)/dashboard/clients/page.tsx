import { requireRoleOrAnalyst } from '@/lib/auth-helpers';
import { listCustomers, getCustomerListSummary } from '@/lib/customers';
import { fetchArdoise } from '@/lib/ardoise';
import { Pagination } from '@/components/(dashboard)/pagination';
import { CustomerSearch } from './customer-search';
import { CustomerFormSheet } from './customer-form';
import { CustomersTable } from './customers-table';

export const dynamic = 'force-dynamic';

const priceFmt = new Intl.NumberFormat('fr-FR');

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  await requireRoleOrAnalyst(['ADMIN']);
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1));
  const search = params.search?.trim() || undefined;

  const [{ customers, total, pageSize }, summary, ardoise] = await Promise.all([
    listCustomers({ search, page }),
    // Toujours calculée sur l'ensemble des clients : ne dépend pas de la
    // recherche, reste stable pendant qu'on filtre le tableau.
    getCustomerListSummary(),
    fetchArdoise(),
  ]);
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-sm text-muted-foreground">
            {total} client{total > 1 ? 's' : ''} identifié
            {total > 1 ? 's' : ''} par téléphone.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CustomerSearch initial={search ?? ''} />
          <CustomerFormSheet mode="create" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Mini label="Clients" value={String(summary.totalClients)} />
        <Mini
          label="Nouveaux (7j / 30j)"
          value={`${summary.newLast7Days} / ${summary.newLast30Days}`}
        />
        <Mini
          label="CA cumulé"
          value={`${priceFmt.format(summary.revenueTotal)} F`}
        />
        <Mini
          label="Panier moyen"
          value={`${priceFmt.format(summary.averageBasket)} F`}
        />
        <Mini
          label="Actifs (≤30 / 31-60 / 61-90j)"
          value={`${summary.active30Days} / ${summary.active60Days} / ${summary.active90Days}`}
        />
        <Mini
          label="Ardoise en cours"
          value={`${priceFmt.format(ardoise.totalOwed)} F`}
          alert={ardoise.totalOwed > 0}
        />
      </div>

      <CustomersTable customers={customers} />

      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} />}
    </div>
  );
}

function Mini({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-2 text-lg font-bold tabular-nums ${alert ? 'text-destructive' : ''}`}
      >
        {value}
      </p>
    </div>
  );
}
