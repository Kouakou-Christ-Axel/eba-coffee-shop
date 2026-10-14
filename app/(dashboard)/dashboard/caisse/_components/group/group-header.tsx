import { Bike, Check, Phone, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { priceFormatter } from '@/config/menu';
import {
  orderRef,
  type GroupSummary,
  type OrderGroup,
} from '@/lib/cashier-queue/group';
import type { CashierOrder } from '@/lib/cashier-queue';

const STATUS_PILL: Record<
  CashierOrder['status'],
  { label: string; cls: string }
> = {
  NEW: { label: 'Reçue', cls: 'bg-muted text-muted-foreground' },
  PREPARING: {
    label: 'En cuisine',
    cls: 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200',
  },
  READY: {
    label: 'Prête',
    cls: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200',
  },
  COMPLETED: {
    label: 'Récupérée',
    cls: 'bg-muted text-muted-foreground',
  },
  CANCELLED: { label: 'Annulée', cls: 'bg-muted text-muted-foreground' },
};

/** Une pastille par commande : n°, statut et paiement, lisibles d'un coup d'œil. */
function OrderPill({ order }: { order: CashierOrder }) {
  const status = STATUS_PILL[order.status];
  return (
    <li className="flex items-center gap-1.5 rounded-lg border bg-background px-2 py-1 text-xs">
      <span className="font-bold tabular-nums">{orderRef(order)}</span>
      <span
        className={cn('rounded-full px-1.5 py-0.5 font-medium', status.cls)}
      >
        {status.label}
      </span>
      {order.orderType === 'DELIVERY' && (
        <Bike
          className={cn(
            'h-3.5 w-3.5',
            order.driverRequested ? 'text-amber-600' : 'text-muted-foreground'
          )}
          aria-label={order.driverRequested ? 'Livreur demandé' : 'Livraison'}
        />
      )}
      {order.isPaid ? (
        <Check className="h-3.5 w-3.5 text-emerald-600" aria-label="Payée" />
      ) : (
        <span className="font-semibold text-red-600 dark:text-red-400">
          {priceFormatter.format(order.total - (order.depositPaid ?? 0))} F
        </span>
      )}
    </li>
  );
}

export function GroupHeader({
  group,
  summary,
}: {
  group: OrderGroup;
  summary: GroupSummary;
}) {
  const readyCount = summary.ready.length;
  const total = summary.total;
  const allReady = readyCount === total;
  const groupTotal = group.orders.reduce((s, o) => s + o.total, 0);
  // Livraison : le livreur ne doit pas partir tant qu'une commande manque.
  const waiting = group.orders.filter(
    (o) => o.status === 'NEW' || o.status === 'PREPARING'
  );
  const showWaitHint =
    summary.deliveries.length > 0 && readyCount > 0 && waiting.length > 0;

  return (
    <header>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <h3 className="truncate text-base font-bold">
              {group.customerName ?? 'Client'}
            </h3>
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
              {total} commandes
            </span>
          </div>
          {group.customerPhone && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <Phone className="h-3 w-3" aria-hidden />
              {group.customerPhone}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-base font-bold tabular-nums">
            {priceFormatter.format(groupTotal)} F
          </p>
          <p
            className={cn(
              'text-xs font-semibold tabular-nums',
              allReady
                ? 'text-emerald-700 dark:text-emerald-300'
                : 'text-muted-foreground'
            )}
          >
            {readyCount}/{total} prêtes
          </p>
        </div>
      </div>

      <div
        className="mt-2 flex h-1.5 gap-0.5 overflow-hidden rounded-full"
        role="img"
        aria-label={`${readyCount} commandes prêtes sur ${total}`}
      >
        {group.orders.map((o) => (
          <span
            key={o.id}
            className={cn(
              'flex-1',
              o.status === 'READY' || o.status === 'COMPLETED'
                ? 'bg-emerald-500'
                : o.status === 'PREPARING'
                  ? 'bg-amber-400'
                  : 'bg-border'
            )}
          />
        ))}
      </div>

      <ul className="mt-2 flex flex-wrap gap-1.5">
        {group.orders.map((o) => (
          <OrderPill key={o.id} order={o} />
        ))}
      </ul>

      {showWaitHint && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          À attendre avant le départ du livreur :{' '}
          {waiting.map(orderRef).join(', ')}
        </p>
      )}
    </header>
  );
}
