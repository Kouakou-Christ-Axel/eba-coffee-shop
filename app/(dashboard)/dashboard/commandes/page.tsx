import Link from 'next/link';
import { requireOrdersView, ROLE_GROUPS } from '@/lib/auth-helpers';
import { listOrders } from '@/lib/orders';
import { Pagination } from '@/components/(dashboard)/pagination';
import { OrdersCardsMobile } from './_components/orders-cards-mobile';
import { OrdersTableDesktop } from './_components/orders-table-desktop';
import { OrdersEmptyState } from './orders-empty-state';
import { OrdersToolbar } from './orders-toolbar';
import { OrderSelectionProvider } from './order-selection';
import {
  parseOrdersSearchParams,
  type OrdersSearchParams,
} from './parse-search-params';

export const dynamic = 'force-dynamic';

export default async function CommandesPage({
  searchParams,
}: {
  searchParams: Promise<OrdersSearchParams>;
}) {
  // `requireOrdersView` consomme ORDERS_VIEW_ROLES, la même liste que l'entrée « Commandes » de la barre latérale :
  // leur divergence avait laissé KITCHEN et COMPTABLE atteindre cette page par l'URL, avec les noms et téléphones des clients.
  const session = await requireOrdersView();
  const canCash = ROLE_GROUPS.CASHIER_PLUS.includes(session.user.role);

  const params = await searchParams;
  const {
    page,
    status,
    search,
    payment,
    sort,
    isAll,
    today,
    fromStr,
    toStr,
    dateFrom,
    dateTo,
  } = parseOrdersSearchParams(params);

  const { orders, total, pageSize } = await listOrders({
    page,
    status,
    dateFrom,
    dateTo,
    search,
    payment,
    sort,
  });
  const totalPages = Math.ceil(total / pageSize);

  // Plage par défaut = aujourd'hui : « rien aujourd'hui » n'est pas une anomalie, contrairement à « rien malgré des filtres ».
  const isDefaultRange = !isAll && fromStr === today && toStr === today;

  const rangeLabel = isAll
    ? 'Toutes les commandes (historique complet)'
    : fromStr === toStr
      ? `Jour de commande : ${fromStr}`
      : `Du ${fromStr} au ${toStr}`;

  // Filtres partagés avec l'export CSV (le tri reste propre à la liste).
  function filterParams(): URLSearchParams {
    const sp = new URLSearchParams();
    if (status) sp.set('status', status);
    if (isAll) sp.set('range', 'all');
    else {
      sp.set('from', fromStr);
      sp.set('to', toStr);
    }
    if (search) sp.set('search', search);
    if (payment) sp.set('payment', payment);
    return sp;
  }

  const exportHref = `/api/export/orders?${filterParams().toString()}`;

  // Annulation en masse : staff caisse+, commandes non déjà annulées (cf. lib/order-permissions.ts).
  const cancellableIds = canCash
    ? orders.filter((o) => o.status !== 'CANCELLED').map((o) => o.id)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Commandes</h1>
          <p className="text-sm text-muted-foreground">
            {rangeLabel}
            {' · '}
            {total} résultat{total > 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <OrdersToolbar
        from={fromStr}
        to={toStr}
        isAll={isAll}
        exportHref={exportHref}
      />

      {/* Raccourci vers les NEW non encaissées de tout jour, qui gonflent indéfiniment « (dont X en attente) » (`getPendingDemand`). */}
      {status !== 'NEW' || payment !== 'unpaid' || !isAll ? (
        <Link
          href="/dashboard/commandes?status=NEW&payment=unpaid&range=all"
          className="block text-sm text-primary underline-offset-2 hover:underline"
        >
          Voir les commandes non encaissées jamais annulées (tous jours)
        </Link>
      ) : null}

      <OrderSelectionProvider cancellableIds={cancellableIds}>
        <OrdersTableDesktop orders={orders} canCash={canCash} />
        <OrdersCardsMobile orders={orders} canCash={canCash} />
      </OrderSelectionProvider>

      {orders.length === 0 && (
        <OrdersEmptyState
          hasSearch={Boolean(search)}
          hasFilters={Boolean(status || payment) || !isDefaultRange}
        />
      )}

      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} />}
    </div>
  );
}
