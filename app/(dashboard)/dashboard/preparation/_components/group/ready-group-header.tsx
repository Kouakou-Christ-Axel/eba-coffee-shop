'use client';

import { CheckCheck, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { orderRef } from '@/lib/orders/customer-groups';
import {
  summarizeKitchenGroup,
  type KitchenGroup,
} from '@/lib/orders/kitchen-group';
import { groupColor } from './group-color';
import { GroupPills } from './group-pills';

/**
 * En-tête d'un groupe dans la liste « Prêtes » : ces commandes se remettent
 * ensemble. Tant qu'une autre cuit encore, on le dit — sinon le client repart
 * avec une seule commande.
 */
export function ReadyGroupHeader({
  group,
  pending,
  onRetrieveMany,
}: {
  group: KitchenGroup;
  pending: boolean;
  onRetrieveMany: (ids: string[]) => void;
}) {
  const color = groupColor(group.key);
  const s = summarizeKitchenGroup(group);
  const readyIds = s.ready.map((o) => o.id);

  return (
    <li
      className={cn(
        'flex flex-col gap-2 rounded-2xl border-2 p-3',
        color.border,
        color.bg
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold',
            color.chip
          )}
        >
          <Users className="h-4 w-4" aria-hidden />À remettre ensemble
        </span>
        <h3 className="text-lg font-bold">{group.customerName ?? 'Client'}</h3>
        <span className="ml-auto text-sm font-semibold tabular-nums text-muted-foreground">
          {s.ready.length}/{s.total} prêtes
        </span>
      </div>
      <GroupPills group={group} />
      {s.cooking.length > 0 && (
        <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
          Attendre {s.cooking.map(orderRef).join(' · ')} avant de remettre
        </p>
      )}
      {readyIds.length > 0 && (
        <button
          type="button"
          disabled={pending}
          onClick={() => onRetrieveMany(readyIds)}
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-green-300 bg-green-50 px-3 text-sm font-semibold text-green-900 transition-colors hover:bg-green-100 disabled:opacity-50 dark:border-green-800 dark:bg-green-950/40 dark:text-green-100"
        >
          <CheckCheck className="h-4 w-4" aria-hidden />
          Tout marquer récupéré ({readyIds.length})
        </button>
      )}
    </li>
  );
}
