import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { orderRef } from '@/lib/orders/customer-groups';
import type { PreparationOrder } from '@/lib/preparation-queue';
import { groupColor } from './group-color';

/** « Avec #017 · #021 » : rappelle, dans le détail agrandi, que cette commande part avec d'autres. */
export function MatesBanner({
  mates,
  groupKey,
}: {
  mates: PreparationOrder[];
  groupKey: string;
}) {
  if (mates.length === 0) return null;
  return (
    <p
      className={cn(
        'flex items-center gap-2 px-5 py-2 text-lg font-bold',
        groupColor(groupKey).chip
      )}
    >
      <Users className="h-5 w-5 shrink-0" aria-hidden />À emballer avec{' '}
      {mates
        .map(
          (o) =>
            `${orderRef(o)} (${o.status === 'READY' ? 'prête' : 'en cuisine'})`
        )
        .join(' · ')}
    </p>
  );
}
