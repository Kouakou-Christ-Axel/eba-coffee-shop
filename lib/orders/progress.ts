// lib/orders/progress.ts
//
// Parcours d'une commande vu par le caissier : frise de statut (fil d'Ariane)
// et UNE action principale « étape suivante ». Pur, serveur et client.
// Le paiement est orthogonal au statut (ardoise, encaissement après coup) :
// il n'est pas une étape de la frise.

import type { OrderStatus } from '@/generated/prisma/client';

export const ORDER_PROGRESS_STEPS = [
  { key: 'NEW', label: 'Reçue' },
  { key: 'PREPARING', label: 'En cuisine' },
  { key: 'READY', label: 'Prête' },
  { key: 'COMPLETED', label: 'Récupérée' },
] as const satisfies readonly { key: OrderStatus; label: string }[];

export type ProgressStepState = 'done' | 'current' | 'todo';

export type ProgressStep = {
  key: OrderStatus;
  label: string;
  state: ProgressStepState;
};

export function getOrderProgress(order: { status: OrderStatus }): {
  steps: ProgressStep[];
  cancelled: boolean;
} {
  const cancelled = order.status === 'CANCELLED';
  const currentIndex = ORDER_PROGRESS_STEPS.findIndex(
    (s) => s.key === order.status
  );
  const steps = ORDER_PROGRESS_STEPS.map((s, i): ProgressStep => {
    let state: ProgressStepState = 'todo';
    if (!cancelled) {
      if (i < currentIndex) state = 'done';
      else if (i === currentIndex) {
        // Une commande récupérée est au bout du parcours : tout est fait.
        state = s.key === 'COMPLETED' ? 'done' : 'current';
      }
    }
    return { ...s, state };
  });
  return { steps, cancelled };
}

export type NextActionKey =
  | 'deposit'
  | 'pay'
  | 'start-preparation'
  | 'mark-ready'
  | 'mark-completed';

export function getNextAction(
  order: {
    status: OrderStatus;
    isPaid: boolean;
    pickupTime: Date | null;
  },
  opts: { needsDeposit: boolean }
): NextActionKey | null {
  if (order.status === 'CANCELLED' || order.status === 'COMPLETED') return null;
  if (!order.isPaid) return opts.needsDeposit ? 'deposit' : 'pay';
  if (order.status === 'NEW' && order.pickupTime) return 'start-preparation';
  if (order.status === 'PREPARING') return 'mark-ready';
  if (order.status === 'READY') return 'mark-completed';
  return null;
}
