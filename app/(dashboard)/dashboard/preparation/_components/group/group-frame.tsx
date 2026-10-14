'use client';

import type { ReactNode } from 'react';
import { Check, CheckCheck, Users } from 'lucide-react';
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
  /** Gestes de groupe : `primary` (vert plein, la suite du travail) ou `outline` (vert discret). */
  actions?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    variant: 'primary' | 'outline';
    icon: 'ready' | 'retrieve';
  }[];
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
  actions = [],
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
      {actions.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          {actions.map((a) => {
            const Icon = a.icon === 'ready' ? Check : CheckCheck;
            return (
              <button
                key={a.label}
                type="button"
                disabled={a.disabled}
                onClick={a.onClick}
                className={cn(
                  'flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-semibold transition-colors disabled:opacity-50 sm:w-auto',
                  a.variant === 'primary'
                    ? 'bg-green-600 font-bold text-white shadow-sm hover:bg-green-700 active:bg-green-800'
                    : 'border border-green-300 bg-green-50 text-green-900 hover:bg-green-100 dark:border-green-800 dark:bg-green-950/40 dark:text-green-100'
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {a.label}
              </button>
            );
          })}
        </div>
      )}
      <ul className="space-y-3">{children}</ul>
    </li>
  );
}
