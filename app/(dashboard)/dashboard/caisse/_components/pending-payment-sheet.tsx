'use client';

import { useCallback, useEffect, useState } from 'react';
import { Ban, Clock, HandCoins, MessageCircle, Phone } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import {
  buildPaymentReminderMessage,
  buildTelLink,
  buildWhatsAppLink,
} from '@/lib/contact-links';
import { getPickupCode } from '@/lib/orders/format';
import { formatRetryDeadline } from '@/lib/orders/payment-panel';

type PendingOrder = {
  id: string;
  dailyNumber: number;
  reference: string;
  customerName: string | null;
  customerPhone: string | null;
  total: number;
  paymentAttempts: number;
  paymentExpiresAt: string;
  createdAt: string;
};

const priceFormatter = new Intl.NumberFormat('fr-FR');
const POLL_MS = 30_000;

/**
 * Tiroir « En attente de paiement » : les commandes en ligne pas encore payées sont
 * masquées de la file caisse (ni cuisine ni stats tant que l'argent n'est pas
 * arrivé). Ici le caissier les voit pour :
 *   - relancer le client (appel, WhatsApp avec le lien de suivi, où il relance
 *     lui-même le paiement) ;
 *   - la PRENDRE EN CAISSE : elle devient une commande ordinaire, encaissée par les
 *     moyens habituels (espèces, Wave…), sans Jèko ni frais ;
 *   - l'annuler.
 *
 * Lecture à la demande hors flux SSE : la liste (petite) est relue toutes les 30 s
 * pour tenir le compteur à jour, et à chaque ouverture.
 */
export function PendingPaymentSheet() {
  const [open, setOpen] = useState(false);
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [loaded, setLoaded] = useState(false);
  // Horloge de la dernière lecture : le rendu reste pur (pas de Date.now()).
  const [now, setNow] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/caisse/orders/pending', {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('fetch failed');
      const data = (await res.json()) as { orders: PendingOrder[] };
      setOrders(data.orders);
      setNow(Date.now());
      setError(null);
    } catch {
      setError('Impossible de charger les commandes en attente');
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    setConfirmCancelId(null);
    if (next) void load();
  }

  async function act(id: string, request: () => Promise<Response>) {
    setBusyId(id);
    setError(null);
    try {
      const res = await request();
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(
          typeof data?.error === 'string' ? data.error : 'Action impossible'
        );
      }
    } catch {
      setError('Action impossible');
    } finally {
      setBusyId(null);
      setConfirmCancelId(null);
      await load();
    }
  }

  // Elle rejoint « À encaisser » toute seule : le flux SSE voit l'UPDATE.
  const takeInCashier = (id: string) =>
    act(id, () =>
      fetch(`/api/caisse/orders/${id}/release`, { method: 'POST' })
    );

  const cancel = (id: string) =>
    act(id, () =>
      fetch(`/api/caisse/orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      })
    );

  const count = orders.length;

  return (
    <>
      <button
        type="button"
        onClick={() => handleOpenChange(true)}
        aria-label={`Commandes en attente de paiement${count ? ` (${count})` : ''}`}
        title="Commandes en attente de paiement"
        className="relative rounded-full bg-muted p-2 text-muted-foreground transition-colors hover:bg-muted/80"
      >
        <Clock className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
            {count}
          </span>
        )}
      </button>

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          className="h-[70vh] max-h-[90vh] gap-0 rounded-t-3xl p-0"
        >
          <SheetHeader className="border-b p-5 pr-14">
            <SheetTitle className="flex items-center gap-2 text-xl">
              <Clock className="h-5 w-5" />
              En attente de paiement
            </SheetTitle>
            <SheetDescription>
              Commandes en ligne pas encore payées : invisibles en cuisine tant
              que l’argent n’est pas arrivé. Relancez le client, ou prenez la
              commande en caisse.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4">
            {error && (
              <p className="mb-3 rounded-lg bg-red-100 px-3 py-2 text-sm font-medium text-red-900 dark:bg-red-950/60 dark:text-red-100">
                {error}
              </p>
            )}

            {!loaded ? (
              <p className="py-8 text-center text-muted-foreground">
                Chargement…
              </p>
            ) : orders.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                Aucune commande en attente de paiement.
              </p>
            ) : (
              <ul className="space-y-3">
                {orders.map((o) => (
                  <PendingRow
                    key={o.id}
                    order={o}
                    now={now}
                    busy={busyId === o.id}
                    confirmingCancel={confirmCancelId === o.id}
                    onTake={() => takeInCashier(o.id)}
                    onAskCancel={() => setConfirmCancelId(o.id)}
                    onCancel={() => cancel(o.id)}
                    onKeep={() => setConfirmCancelId(null)}
                  />
                ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function PendingRow({
  order: o,
  now,
  busy,
  confirmingCancel,
  onTake,
  onAskCancel,
  onCancel,
  onKeep,
}: {
  order: PendingOrder;
  now: number;
  busy: boolean;
  confirmingCancel: boolean;
  onTake: () => void;
  onAskCancel: () => void;
  onCancel: () => void;
  onKeep: () => void;
}) {
  const deadline = formatRetryDeadline(o.paymentExpiresAt);
  const overdue = new Date(o.paymentExpiresAt).getTime() < now;
  const tel = buildTelLink(o.customerPhone);
  const whatsapp = buildWhatsAppLink(
    o.customerPhone,
    buildPaymentReminderMessage({
      customerName: o.customerName,
      dailyNumber: o.dailyNumber,
      trackingUrl: `${window.location.origin}/commande/${o.id}`,
      deadline,
    })
  );

  return (
    <li className="space-y-3 rounded-2xl border bg-card p-4">
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
          {priceFormatter.format(o.total)} FCFA ·{' '}
          <span className={overdue ? 'font-semibold text-amber-600' : ''}>
            {overdue ? 'délai dépassé' : `jusqu’à ${deadline}`}
          </span>
          {o.paymentAttempts > 1 ? ` · ${o.paymentAttempts} tentatives` : ''}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {tel && (
          <Button asChild variant="outline" className="min-h-11">
            <a href={tel}>
              <Phone className="h-4 w-4" />
              Appeler
            </a>
          </Button>
        )}
        {whatsapp && (
          <Button asChild variant="outline" className="min-h-11">
            <a href={whatsapp} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" />
              Relancer
            </a>
          </Button>
        )}
        <Button
          type="button"
          className="min-h-11"
          disabled={busy}
          onClick={onTake}
        >
          <HandCoins className="h-4 w-4" />
          Prendre en caisse
        </Button>
        {confirmingCancel ? (
          <>
            <Button
              type="button"
              variant="destructive"
              className="min-h-11"
              disabled={busy}
              onClick={onCancel}
            >
              Confirmer l’annulation
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              onClick={onKeep}
            >
              Garder
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="ghost"
            className="min-h-11"
            disabled={busy}
            onClick={onAskCancel}
          >
            <Ban className="h-4 w-4" />
            Annuler
          </Button>
        )}
      </div>
    </li>
  );
}
