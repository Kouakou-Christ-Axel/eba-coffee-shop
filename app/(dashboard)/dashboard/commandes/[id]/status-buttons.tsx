'use client';
import { useState, useTransition } from 'react';
import { AlertTriangle } from 'lucide-react';
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
  const [error, setError] = useState<string | null>(null);
  // Une commande annulée APRÈS paiement est un remboursement : la remettre à
  // encaisser n'a pas de sens (miroir du garde-fou serveur dans
  // `setOrderStatus`).
  const actions = (ACTIONS[currentStatus] ?? []).filter(
    (a) => !(currentStatus === 'CANCELLED' && a.next === 'NEW' && isPaid)
  );

  if (actions.length === 0) return null;

  const handleClick = (next: OrderStatus) => {
    setError(null);
    startTransition(async () => {
      // L'action renvoie `{ error }` au lieu de lever : Next redacte le message
      // de toute erreur traversant une Server Action, si bien qu'un refus
      // (droits, conflit d'édition, rupture de stock) ne s'affichait pas et que
      // le bouton paraissait sans effet.
      const result = await updateOrderStatus(orderId, next);
      if (result?.error) setError(result.error);
    });
  };

  return (
    <div className="flex flex-col gap-2">
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
      {error && (
        <p
          role="alert"
          className="flex items-center gap-1.5 text-sm text-destructive"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
