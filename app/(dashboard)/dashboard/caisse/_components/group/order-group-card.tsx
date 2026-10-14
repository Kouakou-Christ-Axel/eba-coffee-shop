'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CashierOrder } from '@/lib/cashier-queue';
import type { CashierGroup } from '@/lib/cashier-queue/group';
import { orderRef } from '@/lib/orders/customer-groups';
import type { MenuCategory } from '@/config/menu';
import { OrderCard } from '../../order-card';
import { OrderCardActions } from '../../order-card-actions';
import { PaymentModal } from '../../payment-modal';
import { getUrgencyLevel, type TabKey } from '../../urgency';
import type { CaisseContactSettings } from '../actions/types';
import { GroupActionsBar } from './group-actions-bar';
import { GroupHeader } from './group-header';
import { useGroupActions } from './use-group-actions';

type Props = {
  group: CashierGroup;
  inTab: CashierOrder[];
  tab: TabKey;
  menu: MenuCategory[];
  contactSettings: CaisseContactSettings;
  now: Date;
  /** Où sont les autres commandes du groupe : « Dans un autre onglet » (file) ou « Hors de la recherche ». */
  othersLabel?: string;
};

/**
 * Un client, plusieurs commandes : un seul bloc avec l'état de TOUT le groupe
 * (même celles qui sont dans un autre onglet) et les actions en lot de l'étape
 * courante. Chaque commande garde sa carte et ses actions individuelles, repliées
 * derrière « Détail », pour corriger un cas particulier sans quitter le groupe.
 */
export function OrderGroupCard({
  group,
  inTab,
  tab,
  menu,
  contactSettings,
  now,
  othersLabel = 'Dans un autre onglet',
}: Props) {
  const actions = useGroupActions(group, contactSettings);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const elsewhere = group.orders.filter(
    (o) => !inTab.some((m) => m.id === o.id)
  );

  return (
    <article className="animate-in fade-in-0 slide-in-from-top-2 duration-300 rounded-2xl border-2 border-primary/40 bg-card p-4 shadow-sm motion-reduce:animate-none">
      <GroupHeader group={group} summary={actions.summary} />

      {elsewhere.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {othersLabel} : {elsewhere.map((o) => orderRef(o)).join(', ')}
        </p>
      )}

      {actions.error && (
        <p
          role="alert"
          className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-800 dark:bg-red-950/40 dark:text-red-200"
        >
          {actions.error}
        </p>
      )}

      <GroupActionsBar tab={tab} actions={actions} />

      <div className="mt-4 flex flex-col gap-3 border-t pt-3">
        {inTab.map((o) => {
          const expanded = open[o.id] ?? false;
          return (
            <div key={o.id}>
              <OrderCard
                order={o}
                urgency={getUrgencyLevel(o, tab, now)}
                now={now}
                actions={
                  <>
                    <button
                      type="button"
                      aria-expanded={expanded}
                      onClick={() =>
                        setOpen((prev) => ({ ...prev, [o.id]: !expanded }))
                      }
                      className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border text-sm font-medium text-muted-foreground hover:bg-muted"
                    >
                      Détail {orderRef(o)}
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 transition-transform motion-reduce:transition-none',
                          expanded && 'rotate-180'
                        )}
                        aria-hidden
                      />
                    </button>
                    {expanded && (
                      <div className="mt-2">
                        <OrderCardActions
                          order={o}
                          menu={menu}
                          contactSettings={contactSettings}
                        />
                      </div>
                    )}
                  </>
                }
              />
            </div>
          );
        })}
      </div>

      <PaymentModal
        isOpen={actions.isPayOpen}
        onClose={() => actions.setIsPayOpen(false)}
        orderRef={`Groupe · ${actions.summary.payable.map(orderRef).join(' ')}`}
        amount={actions.summary.amountToPay}
        isSubmitting={actions.isPending}
        onConfirm={actions.handlePayAll}
        error={actions.payError}
      />
      {actions.dialogs}
    </article>
  );
}
