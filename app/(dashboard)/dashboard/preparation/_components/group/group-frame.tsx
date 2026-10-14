'use client';

import type { ReactNode } from 'react';
import { CheckCheck, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { KitchenGroup } from '@/lib/orders/kitchen-group';
import { groupColor } from './group-color';
import { GroupPills } from './group-pills';

type Props = {
  group: KitchenGroup;
  /** Libellé de la pastille de couleur : « À remettre ensemble », « 3 commandes ensemble »… */
  label: string;
  /** Texte à droite du nom (ex. « 2/3 prêtes »). */
  trailing?: string;
  /** Avertissement ambre sous les pastilles (ex. « Attendre #019 avant de remettre »). */
  notice?: string;
  action?: { label: string; onClick: () => void; disabled?: boolean };
  /** Les lignes de commande, rangées DANS le cadre : elles sont des `<li>`. */
  children: ReactNode;
};

/**
 * Cadre de couleur d'un client groupé dans une LISTE (prêtes, résultats de
 * recherche) : l'en-tête et les lignes des commandes sont dans le même cadre,
 * pour qu'on voie d'un coup d'œil quelles lignes vont ensemble.
 */
export function GroupFrame({
  group,
  label,
  trailing,
  notice,
  action,
  children,
}: Props) {
  const color = groupColor(group.key);
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
          <Users className="h-4 w-4" aria-hidden />
          {label}
        </span>
        <h3 className="text-lg font-bold">{group.customerName ?? 'Client'}</h3>
        {trailing && (
          <span className="ml-auto text-sm font-semibold tabular-nums text-muted-foreground">
            {trailing}
          </span>
        )}
      </div>
      <GroupPills group={group} />
      {notice && (
        <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
          {notice}
        </p>
      )}
      {action && (
        <button
          type="button"
          disabled={action.disabled}
          onClick={action.onClick}
          className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-green-300 bg-green-50 px-3 text-sm font-semibold text-green-900 transition-colors hover:bg-green-100 disabled:opacity-50 dark:border-green-800 dark:bg-green-950/40 dark:text-green-100"
        >
          <CheckCheck className="h-4 w-4" aria-hidden />
          {action.label}
        </button>
      )}
      <ul className="space-y-3">{children}</ul>
    </li>
  );
}
