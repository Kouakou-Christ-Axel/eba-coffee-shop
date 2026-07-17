import Link from 'next/link';
import { Bike, Coffee, ShoppingBag } from 'lucide-react';
import { listOrders } from '@/lib/orders';
import type { OrderSort, PaymentFilter } from '@/lib/orders';
import { getPickupCode } from '@/lib/orders/format';
import { parseDateOnlyToUTC, todayDateString } from '@/lib/timezone';
import type { OrderStatus, OrderType } from '@/generated/prisma/client';
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

      <div className="overflow-x-auto">
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
                    {order.isPaid ? (
                      <Badge variant="default" className="bg-green-600">
                        {order.paymentMode ?? 'Payée'}
                      </Badge>
                    ) : order.status !== 'CANCELLED' ? (
                      <Badge variant="secondary">À encaisser</Badge>
                    ) : (
                      <Badge variant="outline">—</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[order.status]}>
                      {STATUS_LABELS[order.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {!order.isPaid && order.status !== 'CANCELLED' && (
                        <EncaisserButton
                          orderId={order.id}
                          orderRef={`#${String(order.dailyNumber).padStart(3, '0')}`}
                          amount={order.total}
                          variant="outline"
                          size="sm"
                        />
                      )}
                      {order.status !== 'CANCELLED' &&
                        order.status !== 'COMPLETED' && (
                          <ExpressCompleteButton
                            orderId={order.id}
                            orderRef={`#${String(order.dailyNumber).padStart(3, '0')}`}
                            amount={order.total}
                            isPaid={order.isPaid}
                            currentPaymentMode={order.paymentMode}
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
            {orders.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="py-8 text-center text-muted-foreground"
                >
                  Aucune commande pour cette sélection.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} />}
    </div>
  );
}
