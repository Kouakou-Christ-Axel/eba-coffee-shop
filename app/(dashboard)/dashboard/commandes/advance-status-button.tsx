'use client';

// Bouton d'avancement de statut directement dans la liste des commandes.
//
// Sans lui, avancer une commande imposait : ouvrir le détail → dérouler
// jusqu'en bas → cliquer → revenir (en perdant filtres et position de scroll).
// Ce sont pourtant les deux gestes les plus fréquents du comptoir.
//
// Seules les transitions « en avant » sont exposées ici ; les retours arrière
// et les annulations restent sur la page de détail, où le contexte est complet.
// La matrice d'autorisation reste celle du serveur (`lib/order-permissions.ts`).

import { useState, useTransition } from 'react';
import { CheckCheck, ChefHat, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { updateOrderStatus } from './actions';
import type { OrderStatus } from '@/generated/prisma/client';

const NEXT_STEP: Partial<
  Record<OrderStatus, { next: OrderStatus; label: string; Icon: typeof ChefHat }>
> = {
  NEW: { next: 'PREPARING', label: 'Préparer', Icon: ChefHat },
  PREPARING: { next: 'READY', label: 'Prête', Icon: CheckCheck },
};

export function AdvanceStatusButton({
  orderId,
  status,
}: {
  orderId: string;
  status: OrderStatus;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const step = NEXT_STEP[status];
  if (!step) return null;

  const { next, label, Icon } = step;

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await updateOrderStatus(orderId, next);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={isPending}
        title={error ?? undefined}
      >
        {isPending ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <Icon className="mr-1.5 h-4 w-4" />
        )}
        {label}
      </Button>
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </>
  );
}
