'use client';

import { useState } from 'react';
import { CalendarClock, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OrderCard } from '../order-card';
import { OrderCardActions } from '../order-card-actions';
import { formatPickup, getUrgencyLevel } from '../urgency';
import type { CashierOrder } from '@/lib/cashier-queue';
import type { MenuCategory } from '@/config/menu';

type Props = {
  orders: CashierOrder[];
  menu: MenuCategory[];
  now: Date;
};

/**
 * Section repliable des commandes programmées encore en avance (retrait à plus d'1 h).
 * Repliée par défaut : elle signale leur présence sans encombrer le flux de travail actif.
 */
export function ScheduledSection({ orders, menu, now }: Props) {
  const [open, setOpen] = useState(false);

  if (orders.length === 0) return null;

  const next = orders[0]?.pickupTime;

  return (
    <section className="rounded-2xl border-2 border-indigo-300 bg-indigo-50/40 dark:border-indigo-800 dark:bg-indigo-950/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-indigo-900 dark:text-indigo-100">
          <CalendarClock className="h-5 w-5 shrink-0" aria-hidden="true" />
          Programmées
          <span className="rounded-full bg-indigo-600 px-1.5 text-xs font-semibold tabular-nums text-white">
            {orders.length}
          </span>
          {next && (
            <span className="font-normal text-indigo-700 dark:text-indigo-300">
              · prochain retrait {formatPickup(next, now)}
            </span>
          )}
        </span>
        <ChevronDown
          className={cn(
            'h-5 w-5 shrink-0 text-indigo-700 transition-transform dark:text-indigo-300',
            open && 'rotate-180'
          )}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="flex flex-col gap-3 px-4 pb-4">
          {orders.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              urgency={getUrgencyLevel(o, 'in-progress', now)}
              now={now}
              actions={<OrderCardActions order={o} menu={menu} />}
            />
          ))}
        </div>
      )}
    </section>
  );
}
