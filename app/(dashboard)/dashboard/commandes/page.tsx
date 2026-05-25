import Link from 'next/link';
import { Bike, Coffee, ShoppingBag } from 'lucide-react';
import { listOrders } from '@/lib/orders';
import { startOfLocalDay, formatLocalDateOnly } from '@/lib/timezone';
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
import { StatusTabs } from './status-tabs';
import { DateFilter } from './date-filter';

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

function parseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  // Attendu : YYYY-MM-DD
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return undefined;
  return startOfLocalDay(d);
}

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
  searchParams: Promise<{ page?: string; status?: string; date?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1));
  const rawStatus = params.status as OrderStatus | undefined;
  const status =
    rawStatus && VALID_STATUSES.has(rawStatus) ? rawStatus : undefined;

  // Date par défaut : aujourd'hui (sauf si l'utilisateur a explicitement passé `date=all`)
  const today = startOfLocalDay(new Date());
  const dailyDate =
    params.date === 'all' ? undefined : (parseDate(params.date) ?? today);

  const { orders, total, pageSize } = await listOrders({
    page,
    status,
    dailyDate,
  });
  const totalPages = Math.ceil(total / pageSize);

  const selectedDateStr = dailyDate ? formatLocalDateOnly(dailyDate) : 'all';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Commandes</h1>
          <p className="text-sm text-muted-foreground">
            {dailyDate
              ? `Journée du ${formatLocalDateOnly(dailyDate)}`
              : 'Toutes les commandes (historique complet)'}
            {' · '}
            {total} résultat{total > 1 ? 's' : ''}
          </p>
        </div>
        <DateFilter selected={selectedDateStr} status={status} />
      </div>

      <StatusTabs activeStatus={status} />

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead>Créneau</TableHead>
              <TableHead>Articles</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Paiement</TableHead>
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
                  <TableCell>{(order.items as unknown[]).length}</TableCell>
                  <TableCell className="tabular-nums">
                    {new Intl.NumberFormat('fr-FR').format(order.total)} F
                  </TableCell>
                  <TableCell>
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
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/dashboard/commandes/${order.id}`}>
                        Voir
                      </Link>
                    </Button>
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

      {totalPages > 1 && (
        <div className="flex items-center gap-3">
          {page > 1 && (
            <Button variant="outline" size="sm" asChild>
              <Link
                href={`?page=${page - 1}${status ? `&status=${status}` : ''}&date=${selectedDateStr}`}
              >
                Précédent
              </Link>
            </Button>
          )}
          <span className="text-sm text-muted-foreground">
            Page {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Button variant="outline" size="sm" asChild>
              <Link
                href={`?page=${page + 1}${status ? `&status=${status}` : ''}&date=${selectedDateStr}`}
              >
                Suivant
              </Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
