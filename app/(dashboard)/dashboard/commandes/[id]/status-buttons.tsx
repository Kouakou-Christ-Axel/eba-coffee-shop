'use client';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { updateOrderStatus } from '../actions';
import type { OrderStatus } from '@/generated/prisma/client';

const ACTIONS: Record<
  OrderStatus,
  {
    label: string;
    next: OrderStatus;
    variant?: 'default' | 'destructive' | 'outline';
  }[]
> = {
  NEW: [
    { label: 'Démarrer la préparation', next: 'PREPARING' },
    { label: 'Annuler', next: 'CANCELLED', variant: 'destructive' },
  ],
  PREPARING: [
    { label: 'Marquer comme prête', next: 'READY' },
    { label: 'Annuler', next: 'CANCELLED', variant: 'destructive' },
  ],
  READY: [{ label: 'Marquer comme récupérée', next: 'COMPLETED' }],
  COMPLETED: [],
  // Le client revient réclamer une commande annulée faute d'attente : on la
  // ramène « à encaisser » plutôt que de la ressaisir.
  CANCELLED: [
    { label: 'Remettre à encaisser', next: 'NEW', variant: 'outline' },
  ],
};

export function StatusButtons({
  orderId,
  currentStatus,
  isPaid,
}: {
  orderId: string;
  currentStatus: OrderStatus;
  isPaid: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  // Une commande annulée APRÈS paiement est un remboursement : la remettre à
  // encaisser n'a pas de sens (miroir du garde-fou serveur dans
  // `setOrderStatus`).
  const actions = (ACTIONS[currentStatus] ?? []).filter(
    (a) => !(currentStatus === 'CANCELLED' && a.next === 'NEW' && isPaid)
  );

  if (actions.length === 0) return null;

  const handleClick = (next: OrderStatus) => {
    startTransition(async () => {
      await updateOrderStatus(orderId, next);
    });
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      {actions.map(({ label, next, variant = 'default' }) => (
        <Button
          key={next}
          variant={variant}
          disabled={isPending}
          onClick={() => handleClick(next)}
          className="w-full sm:w-auto"
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
