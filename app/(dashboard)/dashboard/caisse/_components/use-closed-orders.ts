'use client';

import { useState } from 'react';
import type { OrderStatus } from '@/generated/prisma/client';
import { useUndoToast } from '@/lib/hooks/use-undo-toast';
import { getReopenPlan, type ReopenPlan } from '@/lib/orders/reopen';
import type { ShortageLine } from '@/lib/orders/shortage';
import { callApi, withShortageRetry } from './actions/call-api';

export type ClosedOrder = {
  id: string;
  dailyNumber: number;
  reference: string;
  customerName: string | null;
  customerPhone: string | null;
  total: number;
  status: OrderStatus;
  isPaid: boolean;
  paymentExpiresAt: string | null;
  updatedAt: string;
};

export type ClosedOrderWithPlan = ClosedOrder & { plan: ReopenPlan };

/** Charge les commandes du jour à rattraper (à l'ouverture) et les remet dans le process. */
export function useClosedOrders(
  confirmShortage: (shortage: ShortageLine[]) => Promise<boolean>
) {
  const [orders, setOrders] = useState<ClosedOrderWithPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { pushUndo } = useUndoToast();

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/caisse/orders/closed');
      if (!res.ok) throw new Error('fetch failed');
      const data = (await res.json()) as { orders: ClosedOrder[] };
      setOrders(
        data.orders.flatMap((o) => {
          const plan = getReopenPlan(o);
          return plan ? [{ ...o, plan }] : [];
        })
      );
    } catch {
      setError('Impossible de charger les commandes');
    } finally {
      setLoading(false);
    }
  }

  /** `true` si la commande est repartie (le SSE la ramène ensuite dans le bon onglet). */
  async function reopen(order: ClosedOrderWithPlan): Promise<boolean> {
    setBusyId(order.id);
    setError(null);
    try {
      const result = await withShortageRetry(
        (coverShortage) =>
          callApi(`/api/caisse/orders/${order.id}/status`, 'PATCH', {
            status: order.plan.target,
            ...(coverShortage ? { coverShortage: true } : {}),
          }),
        confirmShortage
      );
      if (!result.ok) {
        setError(result.error);
        return false;
      }
      setOrders((prev) => prev.filter((o) => o.id !== order.id));
      const ref = `#${String(order.dailyNumber).padStart(3, '0')}`;
      pushUndo({
        message: `Commande ${ref} remise dans le process`,
        onUndo: async () => {
          const undo = await callApi(
            `/api/caisse/orders/${order.id}/status`,
            'PATCH',
            { status: order.status }
          );
          if (!undo.ok) throw new Error(undo.error);
        },
      });
      return true;
    } finally {
      setBusyId(null);
    }
  }

  return { orders, loading, error, busyId, load, reopen };
}
