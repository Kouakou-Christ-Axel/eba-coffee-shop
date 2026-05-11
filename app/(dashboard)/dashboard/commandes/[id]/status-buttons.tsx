'use client';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { updateOrderStatus } from '../actions';
import type { OrderStatus } from '@/generated/prisma';

const ACTIONS: Record<
  string,
  {
    label: string;
    next: OrderStatus;
    variant?: 'default' | 'destructive' | 'outline';
  }[]
> = {
  PENDING: [
    { label: 'Confirmer', next: 'CONFIRMED' },
    { label: 'Annuler', next: 'CANCELLED', variant: 'destructive' },
  ],
  CONFIRMED: [
    { label: 'Marquer comme prête', next: 'READY' },
    { label: 'Annuler', next: 'CANCELLED', variant: 'destructive' },
  ],
  READY: [{ label: 'Marquer comme récupérée', next: 'PICKED_UP' }],
  PICKED_UP: [],
  CANCELLED: [],
};

export function StatusButtons({
  orderId,
  currentStatus,
}: {
  orderId: string;
  currentStatus: OrderStatus;
}) {
  const [isPending, startTransition] = useTransition();
  const actions = ACTIONS[currentStatus] ?? [];

  if (actions.length === 0) return null;

  const handleClick = (next: OrderStatus) => {
    startTransition(async () => {
      await updateOrderStatus(orderId, next);
    });
  };

  return (
    <div className="flex gap-2">
      {actions.map(({ label, next, variant = 'default' }) => (
        <Button
          key={next}
          variant={variant}
          disabled={isPending}
          onClick={() => handleClick(next)}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
