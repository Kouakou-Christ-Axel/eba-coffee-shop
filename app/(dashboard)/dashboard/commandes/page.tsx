import Link from 'next/link';
import { Bike, Coffee, ShoppingBag, Globe, Bot } from 'lucide-react';
import { requireOrdersView, ROLE_GROUPS } from '@/lib/auth-helpers';
import { listOrders } from '@/lib/orders';
import type { OrderSort, PaymentFilter } from '@/lib/orders';
import { getPickupCode } from '@/lib/orders/format';
import { parseDateOnlyToUTC, todayDateString } from '@/lib/timezone';
import type {
  OrderSource,
  OrderStatus,
  OrderType,
} from '@/generated/prisma/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EncaisserButton } from './encaisser-button';
import { ExpressCompleteButton } from './express-complete-button';
import { AdvanceStatusButton } from './advance-status-button';
import { OrdersEmptyState } from './orders-empty-state';
import { OrdersToolbar } from './orders-toolbar';
import { Pagination } from './pagination';

export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: 'Nouvelle',
  PREPARING: 'En cours',
  READY: 'Prête',
  COMPLETED: 'Récupérée',
  CANCELLED: 'Annulée',
};

const STATUS_VARIANTS: Record<
  OrderStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  NEW: 'secondary',
  PREPARING: 'default',
  READY: 'default',
  COMPLETED: 'outline',
  CANCELLED: 'destructive',
};

// « En cours » et « Prête » partageaient la même variante : la distinction la
// plus utile sur le terrain (le café attend-il le client ?) était invisible.
// On sur-colore READY en vert plutôt que d'inventer une variante de Badge.
const STATUS_EXTRA_CLASS: Partial<Record<OrderStatus, string>> = {
  READY: 'bg-green-600 hover:bg-green-600/90',
};

function PaymentBadge({
  isPaid,
  status,
  paymentMode,
  autoValidatedByAi,
}: {
  isPaid: boolean;
  status: OrderStatus;
  paymentMode: string | null;
  autoValidatedByAi: boolean;
}) {
  if (isPaid) {
    return (
      <Badge
        variant="default"
        className="inline-flex items-center gap-1 bg-green-600"
      >
        {paymentMode ?? 'Fractionné'}
        {autoValidatedByAi && (
          <span title="Encaissement automatique (IA)">
            <Bot className="h-3 w-3" aria-hidden="true" />
          </span>
        )}
      </Badge>
    );
  }
  if (status !== 'CANCELLED')
    return <Badge variant="secondary">À encaisser</Badge>;
  return <Badge variant="outline">—</Badge>;
}

function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge
      variant={STATUS_VARIANTS[status]}
      className={STATUS_EXTRA_CLASS[status]}
    >
      {STATUS_LABELS[status]}
    </Badge>
  );
}

const TYPE_ICONS: Record<OrderType, typeof Bike> = {
  DELIVERY: Bike,
  DINE_IN: Coffee,
  TAKEAWAY: ShoppingBag,
};

const TYPE_LABELS: Record<OrderType, string> = {
  DELIVERY: 'Livraison',
  DINE_IN: 'Sur place',
  TAKEAWAY: 'À emporter',
};

// Origine de création — le cas courant CASHIER n'affiche rien (pas de bruit
// visuel sur la majorité des lignes) ; ONLINE/MCP se distinguent d'un badge.
const SOURCE_META: Partial<
  Record<OrderSource, { label: string; title: string; Icon: typeof Globe }>
> = {
  ONLINE: {
    label: 'En ligne',
    title: 'Commande passée par le client sur le site',
    Icon: Globe,
  },
  MCP: {
    label: 'MCP',
    title: 'Commande saisie via l’outil MCP (rétroactive)',
    Icon: Bot,
  },
};

const VALID_STATUSES = new Set<OrderStatus>([
  'NEW',
  'PREPARING',
  'READY',
  'COMPLETED',
  'CANCELLED',
]);

const VALID_PAYMENTS = new Set<PaymentFilter>([
  'unpaid',
  'CASH',
  'WAVE',
  'ORANGE_MONEY',
  'OTHER',
]);

const VALID_SORTS = new Set<OrderSort>([
  'recent',
  'oldest',
  'total_desc',
  'total_asc',
  'number',
]);

function formatPickupTime(date: Date | null): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(date)
    .replace(':', 'h');
}

export default async function CommandesPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    status?: string;
    from?: string;
    to?: string;
    range?: string;
    search?: string;
    payment?: string;
    sort?: string;
  }>;
}) {
  // Cette page n'avait AUCUNE garde : seul le layout dashboard filtrait, et il
  // laisse passer les sept rôles staff. KITCHEN et COMPTABLE — à qui la barre
  // latérale ne montre pourtant pas « Commandes »
  // (components/(dashboard)/dashboard-sidebar.tsx) — y accédaient donc en
  // tapant l'URL, avec les noms et téléphones de tous les clients.
  // `requireOrdersView` consomme ORDERS_VIEW_ROLES, la MÊME liste que celle qui
  // pilote l'entrée « Commandes » de la barre latérale — c'est leur divergence
  // qui avait ouvert la brèche.
  const session = await requireOrdersView();
  const canCash = ROLE_GROUPS.CASHIER_PLUS.includes(session.user.role);

  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1));
  const rawStatus = params.status as OrderStatus | undefined;
  const status =
    rawStatus && VALID_STATUSES.has(rawStatus) ? rawStatus : undefined;
  const search = params.search?.trim() || undefined;
  const rawPayment = params.payment as PaymentFilter | undefined;
  const payment =
    rawPayment && VALID_PAYMENTS.has(rawPayment) ? rawPayment : undefined;
  const rawSort = params.sort as OrderSort | undefined;
  const sort = rawSort && VALID_SORTS.has(rawSort) ? rawSort : 'recent';

  // Plage de dates (jour civil Abidjan). Défaut : aujourd'hui → aujourd'hui.
  // `range=all` désactive le filtre de date (historique complet).
  const isAll = params.range === 'all';
  const today = todayDateString();
  let fromStr = '';
  let toStr = '';
  let dateFrom: Date | undefined;
  let dateTo: Date | undefined;
  if (!isAll) {
    fromStr = parseDateOnlyToUTC(params.from) ? params.from! : today;
    toStr = parseDateOnlyToUTC(params.to) ? params.to! : fromStr;
    if (fromStr > toStr) toStr = fromStr; // YYYY-MM-DD comparable lexicalement
    dateFrom = parseDateOnlyToUTC(fromStr);
    dateTo = parseDateOnlyToUTC(toStr);
  }

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

  // Plage par défaut = la journée en cours. Sert à l'état vide : « rien
  // aujourd'hui » n'est pas une anomalie, contrairement à « rien alors que j'ai
  // posé des filtres ».
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
        status={status}
        payment={payment}
        sort={sort}
        search={search ?? ''}
        from={fromStr}
        to={toStr}
        isAll={isAll}
        exportHref={exportHref}
      />

      <div className="hidden overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead>Créneau</TableHead>
              <TableHead className="hidden md:table-cell">Articles</TableHead>
              <TableHead>Total</TableHead>
              <TableHead className="hidden md:table-cell">Paiement</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => {
              const TypeIcon = TYPE_ICONS[order.orderType];
              return (
                <TableRow key={order.id}>
                  <TableCell className="font-mono text-sm">
                    #{String(order.dailyNumber).padStart(3, '0')}
                    <span
                      className="ml-1.5 rounded bg-primary/10 px-1 text-xs text-primary"
                      title={`Code de retrait · ${order.reference}`}
                    >
                      {getPickupCode(order.reference)}
                    </span>
                    {SOURCE_META[order.source] && (
                      <span
                        className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        title={SOURCE_META[order.source]!.title}
                      >
                        {(() => {
                          const { Icon, label } = SOURCE_META[order.source]!;
                          return (
                            <>
                              <Icon className="h-3 w-3" aria-hidden="true" />
                              {label}
                            </>
                          );
                        })()}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span
                      className="inline-flex items-center gap-1 text-xs"
                      title={TYPE_LABELS[order.orderType]}
                    >
                      <TypeIcon className="h-4 w-4" />
                      <span className="hidden sm:inline">
                        {TYPE_LABELS[order.orderType]}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell>{order.customerName ?? '—'}</TableCell>
                  <TableCell>{order.customerPhone ?? '—'}</TableCell>
                  <TableCell>{formatPickupTime(order.pickupTime)}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {(order.items as unknown[]).length}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {new Intl.NumberFormat('fr-FR').format(order.total)} F
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <PaymentBadge
                      isPaid={order.isPaid}
                      status={order.status}
                      paymentMode={order.paymentMode}
                      autoValidatedByAi={order.paymentAutoValidatedByAi}
                    />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={order.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {/* ANALYSTE a le lien « Commandes » dans la barre
                          latérale mais est hors CASHIER_ROLES : ces boutons
                          n'aboutissaient qu'à un refus serveur. */}
                      {canCash && (
                        <AdvanceStatusButton
                          orderId={order.id}
                          status={order.status}
                        />
                      )}
                      {canCash &&
                        !order.isPaid &&
                        order.status !== 'CANCELLED' && (
                          <EncaisserButton
                            orderId={order.id}
                            orderRef={`#${String(order.dailyNumber).padStart(3, '0')}`}
                            amount={order.total}
                            variant="outline"
                            size="sm"
                          />
                        )}
                      {canCash &&
                        order.status !== 'CANCELLED' &&
                        order.status !== 'COMPLETED' && (
                          <ExpressCompleteButton
                            orderId={order.id}
                            orderRef={`#${String(order.dailyNumber).padStart(3, '0')}`}
                            amount={order.total}
                            isPaid={order.isPaid}
                            variant="outline"
                            size="sm"
                          />
                        )}
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/commandes/${order.id}`}>
                          Voir
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Téléphone : le tableau à 10 colonnes ne tient pas — il fallait le
          faire défiler horizontalement, et la colonne « Paiement » (masquée
          sous md) était précisément le signal « à encaisser » dont le caissier
          a besoin sur son propre appareil. */}
      <div className="flex flex-col gap-3 md:hidden">
        {orders.map((order) => {
          const TypeIcon = TYPE_ICONS[order.orderType];
          const orderRef = `#${String(order.dailyNumber).padStart(3, '0')}`;
          return (
            <div
              key={order.id}
              className="flex flex-col gap-2 rounded-xl border bg-card p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/dashboard/commandes/${order.id}`}
                  className="min-w-0 flex-1"
                >
                  <p className="flex flex-wrap items-center gap-1.5 font-mono text-sm font-semibold">
                    {orderRef}
                    <span
                      className="rounded bg-primary/10 px-1 text-xs text-primary"
                      title={`Code de retrait · ${order.reference}`}
                    >
                      {getPickupCode(order.reference)}
                    </span>
                    <span className="inline-flex items-center gap-1 font-sans text-xs font-normal text-muted-foreground">
                      <TypeIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      {TYPE_LABELS[order.orderType]}
                    </span>
                  </p>
                  <p className="mt-0.5 truncate text-sm">
                    {order.customerName ?? 'Client non identifié'}
                    {order.customerPhone && (
                      <span className="text-muted-foreground">
                        {' · '}
                        {order.customerPhone}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatPickupTime(order.pickupTime)}
                  </p>
                </Link>
                <span className="shrink-0 text-right text-base font-bold tabular-nums">
                  {new Intl.NumberFormat('fr-FR').format(order.total)} F
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <StatusBadge status={order.status} />
                <PaymentBadge
                  isPaid={order.isPaid}
                  status={order.status}
                  paymentMode={order.paymentMode}
                  autoValidatedByAi={order.paymentAutoValidatedByAi}
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {canCash && (
                  <AdvanceStatusButton
                    orderId={order.id}
                    status={order.status}
                  />
                )}
                {canCash && !order.isPaid && order.status !== 'CANCELLED' && (
                  <EncaisserButton
                    orderId={order.id}
                    orderRef={orderRef}
                    amount={order.total}
                    variant="outline"
                    size="sm"
                  />
                )}
                {canCash &&
                  order.status !== 'CANCELLED' &&
                  order.status !== 'COMPLETED' && (
                    <ExpressCompleteButton
                      orderId={order.id}
                      orderRef={orderRef}
                      amount={order.total}
                      isPaid={order.isPaid}
                      variant="outline"
                      size="sm"
                    />
                  )}
                <Button variant="ghost" size="sm" asChild className="ml-auto">
                  <Link href={`/dashboard/commandes/${order.id}`}>Voir</Link>
                </Button>
              </div>
            </div>
          );
        })}
      </div>

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
