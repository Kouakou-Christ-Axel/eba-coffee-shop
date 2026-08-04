'use client';

import { useState } from 'react';
import { Ban, RotateCcw } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { getPickupCode } from '@/lib/orders/format';
import { formatAbidjanTime } from '@/lib/timezone';

type CancelledOrder = {
  id: string;
  dailyNumber: number;
  reference: string;
  customerName: string | null;
  customerPhone: string | null;
  total: number;
  isPaid: boolean;
  updatedAt: string;
};

const priceFormatter = new Intl.NumberFormat('fr-FR');

/**
 * Tiroir « Commandes annulées du jour » : le client revient réclamer une
 * commande annulée faute d'attente, le caissier la remet « à encaisser » en un
 * geste (CANCELLED → NEW, transition déjà autorisée côté serveur).
 *
 * La liste est chargée À L'OUVERTURE seulement — les annulées sont hors de la
 * file SSE (cf. `lib/cashier-queue.ts`), et les faire transiter à chaque tick
 * coûterait cher pour un cas rare. Le retour dans la file se fait ensuite tout
 * seul : le trigger Postgres NOTIFY se déclenche sur l'UPDATE.
 */
export function CancelledSheet() {
  const [open, setOpen] = useState(false);
  const [orders, setOrders] = useState<CancelledOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  async function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/caisse/orders/cancelled');
      if (!res.ok) throw new Error('fetch failed');
      const data = (await res.json()) as { orders: CancelledOrder[] };
      setOrders(data.orders);
    } catch {
      setError('Impossible de charger les commandes annulées');
    } finally {
      setLoading(false);
    }
  }

  async function restore(id: string) {
    setRestoringId(id);
    setError(null);
    try {
      const res = await fetch(`/api/caisse/orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'NEW' }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(
          typeof data?.error === 'string' ? data.error : 'Reprise impossible'
        );
        return;
      }
      // Le flux SSE la ramène dans « À encaisser » de lui-même.
      setOpen(false);
    } catch {
      setError('Reprise impossible');
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => handleOpenChange(true)}
        aria-label="Commandes annulées du jour"
        title="Commandes annulées du jour"
        className="rounded-full bg-muted p-2 text-muted-foreground transition-colors hover:bg-muted/80"
      >
        <Ban className="h-4 w-4" />
      </button>

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          className="h-[60vh] max-h-[85vh] gap-0 rounded-t-3xl p-0"
        >
          <SheetHeader className="border-b p-5 pr-14">
            <SheetTitle className="flex items-center gap-2 text-xl">
              <Ban className="h-5 w-5" />
              Annulées aujourd’hui
            </SheetTitle>
            <SheetDescription>
              Le client revient ? Remettez la commande à encaisser sans la
              ressaisir.
            </SheetDescription>
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
            ) : orders.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                Aucune commande annulée aujourd’hui.
              </p>
            ) : (
              <ul className="space-y-3">
                {orders.map((o) => (
                  <li
                    key={o.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4"
                  >
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-mono text-xl font-bold leading-none">
                        #{String(o.dailyNumber).padStart(3, '0')}
                        <span
                          className="rounded bg-primary/10 px-1.5 py-0.5 text-base text-primary"
                          title="Code de retrait"
                        >
                          {getPickupCode(o.reference)}
                        </span>
                      </p>
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {o.customerName ?? 'Client anonyme'}
                        {o.customerPhone ? ` · ${o.customerPhone}` : ''}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {priceFormatter.format(o.total)} FCFA · annulée à{' '}
                        {formatAbidjanTime(new Date(o.updatedAt))}
                      </p>
                    </div>

                    {o.isPaid ? (
                      // Annulée APRÈS paiement = remboursement : la remettre à
                      // encaisser réclamerait un second encaissement (miroir du
                      // garde-fou serveur dans `setOrderStatus`).
                      <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-900 dark:bg-red-950/60 dark:text-red-100">
                        Remboursée
                      </span>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={restoringId === o.id}
                        onClick={() => restore(o.id)}
                      >
                        <RotateCcw className="h-4 w-4" />
                        Remettre à encaisser
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
