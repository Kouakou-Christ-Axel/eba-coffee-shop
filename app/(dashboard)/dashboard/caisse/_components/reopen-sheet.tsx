'use client';

import { useState } from 'react';
import { History } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { ReopenKind } from '@/lib/orders/reopen';
import type { ShortageLine } from '@/lib/orders/shortage';
import { useConfirmDialog } from '../../_components/use-confirm-dialog';
import { useShortageConfirm } from '../../_components/use-shortage-confirm';
import { KIND_META, ReopenRow } from './reopen-row';
import { useClosedOrders, type ClosedOrderWithPlan } from './use-closed-orders';

type Filter = ReopenKind | 'all';
const FILTERS: Filter[] = [
  'all',
  'completed',
  'cancelled',
  'refunded',
  'expired',
];

/**
 * Tiroir « Corrections du jour » : remet dans le process une commande
 * récupérée, annulée, remboursée ou expirée par erreur, sans la ressaisir.
 * Liste chargée À L'OUVERTURE seulement (hors file SSE, cf. route `closed`).
 */
export function ReopenSheet() {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  // Les boîtes de confirmation (HeroUI) ne sont pas cliquables tant que le tiroir
  // (Radix) verrouille la page : on le masque le temps de la question.
  const [hidden, setHidden] = useState(false);
  const { confirm, confirmDialog } = useConfirmDialog();
  const { confirmShortage, shortageDialog } = useShortageConfirm();
  async function whileHidden<T>(ask: () => Promise<T>): Promise<T> {
    setHidden(true);
    try {
      return await ask();
    } finally {
      setHidden(false);
    }
  }
  const { orders, loading, error, busyId, load, reopen } = useClosedOrders(
    (shortage: ShortageLine[]) => whileHidden(() => confirmShortage(shortage))
  );

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) void load();
  }

  async function handleReopen(order: ClosedOrderWithPlan) {
    // Un remboursement annulé relance la cuisine : on confirme avant.
    if (order.plan.kind === 'refunded') {
      const ok = await whileHidden(() =>
        confirm({
          title: 'Annuler le remboursement ?',
          message: `La commande #${String(order.dailyNumber).padStart(3, '0')} reste payée et repart en cuisine. Vérifiez que l’argent n’a pas été rendu au client.`,
          confirmLabel: 'Annuler le remboursement',
        })
      );
      if (!ok) return;
    }
    if (await reopen(order)) setOpen(false);
  }

  const visible =
    filter === 'all' ? orders : orders.filter((o) => o.plan.kind === filter);

  return (
    <>
      <button
        type="button"
        onClick={() => handleOpenChange(true)}
        aria-label="Corrections du jour"
        title="Corrections du jour"
        className="rounded-full bg-muted p-2 text-muted-foreground transition-colors hover:bg-muted/80"
      >
        <History className="h-4 w-4" />
      </button>

      <Sheet open={open && !hidden} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          className="h-[70vh] max-h-[90vh] gap-0 rounded-t-3xl p-0"
        >
          <SheetHeader className="border-b p-5 pr-14">
            <SheetTitle className="flex items-center gap-2 text-xl">
              <History className="h-5 w-5" />
              Corrections du jour
            </SheetTitle>
            <SheetDescription>
              Récupérée, annulée, remboursée ou expirée par erreur ? Remettez-la
              dans le process.
            </SheetDescription>
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pt-2">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={filter === f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'h-9 shrink-0 rounded-full px-3 text-sm font-medium transition-colors',
                    filter === f
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  {f === 'all' ? 'Toutes' : KIND_META[f].label}
                </button>
              ))}
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4">
            {error && (
              <p className="mb-3 rounded-lg bg-red-100 px-3 py-2 text-sm font-medium text-red-900 dark:bg-red-950/60 dark:text-red-100">
                {error}
              </p>
            )}
            {loading ? (
              <p className="py-8 text-center text-muted-foreground">
                Chargement…
              </p>
            ) : visible.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                Aucune commande à rattraper aujourd’hui.
              </p>
            ) : (
              <ul className="space-y-3">
                {visible.map((o) => (
                  <ReopenRow
                    key={o.id}
                    order={o}
                    busy={busyId === o.id}
                    disabled={busyId !== null}
                    onReopen={() => void handleReopen(o)}
                  />
                ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>
      {confirmDialog}
      {shortageDialog}
    </>
  );
}
