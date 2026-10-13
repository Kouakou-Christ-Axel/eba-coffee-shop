'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PendingOrder } from './types';

const POLL_MS = 30_000;

export function usePendingOrders() {
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

  return {
    open,
    orders,
    loaded,
    now,
    error,
    busyId,
    confirmCancelId,
    setConfirmCancelId,
    handleOpenChange,
    takeInCashier,
    cancel,
  };
}
