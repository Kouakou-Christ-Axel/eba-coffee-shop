// Tuiles de synthèse de /dashboard/clients. Composant serveur autonome : sa
// propre lecture en base, son propre `Suspense` dans la page — elles
// s'affichent indépendamment du tableau (et inversement).

import { getCustomerListSummary } from '@/lib/customers';
import { fetchArdoise } from '@/lib/ardoise';

const priceFmt = new Intl.NumberFormat('fr-FR');

export async function SummaryCards() {
  // Toujours calculées sur l'ensemble des clients : ne dépendent pas de la
  // recherche, restent stables pendant qu'on filtre le tableau.
  const [summary, ardoise] = await Promise.all([
    getCustomerListSummary(),
    fetchArdoise(),
  ]);

  return (
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
  );
}

export function SummaryCardsSkeleton() {
  return (
    <div
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
      aria-busy="true"
    >
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="rounded-xl border bg-card p-4">
          <div className="h-3 w-20 animate-pulse rounded bg-muted" />
          <div className="mt-3 h-6 w-24 animate-pulse rounded bg-muted" />
        </div>
      ))}
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
