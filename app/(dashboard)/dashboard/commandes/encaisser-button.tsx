'use client';

// Bouton « Encaisser » réutilisable dans la section Commandes (ligne du tableau
// et page de détail). Ouvre la modale de paiement partagée avec la caisse et
// branche la server action `markOrderPaidAction` (qui revalide la page).

import { useState, useTransition } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PaymentMode } from '@/generated/prisma/client';
import { PaymentModal } from '../caisse/payment-modal';
import { markOrderPaidAction } from './actions';

type Props = {
  orderId: string;
  orderRef: string;
  amount: number;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
  label?: string;
};

export function EncaisserButton({
  orderId,
  orderRef,
  amount,
  variant = 'default',
  size = 'sm',
  className,
  label = 'Encaisser',
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm(mode: PaymentMode) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await markOrderPaidAction(orderId, mode);
        if (result?.error) {
          setError(result.error);
          return;
        }
        setIsOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur serveur');
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={() => setIsOpen(true)}
      >
        <Check className="mr-1.5 h-4 w-4" />
        {label}
      </Button>

      <PaymentModal
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          setError(null);
        }}
        orderRef={orderRef}
        amount={amount}
        isSubmitting={isPending}
        onConfirm={handleConfirm}
        error={error}
      />
    </>
  );
}
