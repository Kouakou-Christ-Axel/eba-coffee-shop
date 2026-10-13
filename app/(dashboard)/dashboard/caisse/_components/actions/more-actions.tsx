'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CashierOrder } from '@/lib/cashier-queue';
import { EditSection } from './edit-section';
import type { CaisseContactSettings } from './types';
import type { OrderActions } from './use-order-actions';
import type { OrderView } from './use-order-view';

/** Actions rares (modifier, copier, annuler) repliées : elles ne noient plus le geste principal. */
export function MoreActions({
  order,
  view,
  actions,
  contactSettings,
}: {
  order: CashierOrder;
  view: OrderView;
  actions: OrderActions;
  contactSettings: CaisseContactSettings;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="ghost"
        size="lg"
        className="h-11 w-full text-muted-foreground"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Plus d&apos;actions
        <ChevronDown
          className={cn(
            'ml-1.5 h-4 w-4 transition-transform motion-reduce:transition-none',
            open && 'rotate-180'
          )}
          aria-hidden="true"
        />
      </Button>
      {/* Montée même repliée : les erreurs d'action (ex. 409) doivent rester visibles. */}
      {open ? (
        <EditSection
          order={order}
          view={view}
          actions={actions}
          contactSettings={contactSettings}
        />
      ) : (
        actions.actionError && (
          <p className="text-xs text-destructive">{actions.actionError}</p>
        )
      )}
    </div>
  );
}
