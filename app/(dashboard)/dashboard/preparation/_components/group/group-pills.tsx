import { cn } from '@/lib/utils';
import { orderRef } from '@/lib/orders/customer-groups';
import type { KitchenGroup } from '@/lib/orders/kitchen-group';

/** Une pastille par commande du groupe : n° + où elle en est (cuisine / prête). */
export function GroupPills({ group }: { group: KitchenGroup }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {group.orders.map((o) => (
        <li
          key={o.id}
          className="flex items-center gap-1.5 rounded-lg border bg-background px-2 py-1 text-sm"
        >
          <span className="font-mono font-bold">{orderRef(o)}</span>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-semibold',
              o.status === 'READY'
                ? 'bg-green-100 text-green-900 dark:bg-green-950/60 dark:text-green-200'
                : 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200'
            )}
          >
            {o.status === 'READY' ? 'Prête' : 'En cuisine'}
          </span>
        </li>
      ))}
    </ul>
  );
}
