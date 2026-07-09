'use client';

// Bouton « Payer & récupérer » : finalise une commande en un clic (payée +
// récupérée). Si la commande n'est pas encore payée, ouvre la modale de paiement
// partagée pour choisir le mode ; si elle l'est déjà, c'est un bouton direct.
// Branche la server action `payAndCompleteAction` (qui revalide la page).

import { useState, useTransition } from 'react';
import { CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PaymentMode } from '@/generated/prisma/client';
import { PaymentModal } from '../caisse/payment-modal';
import { payAndCompleteAction } from './actions';

type Props = {
  orderId: string;
  orderRef: string;
  amount: number;
  /** Commande déjà encaissée : pas de modale, finalisation directe. */
  isPaid?: boolean;
  /** Mode déjà enregistré (réutilisé tel quel quand `isPaid`). */
  currentPaymentMode?: PaymentMode | null;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
  label?: string;
};

export function ExpressCompleteButton({
  orderId,
  orderRef,
  amount,
  isPaid = false,
  currentPaymentMode,
  variant = 'default',
  size = 'sm',
  className,
  label = 'Payer & récupérer',
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function complete(mode: PaymentMode) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await payAndCompleteAction(orderId, mode);
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

  function handleClick() {
    // Déjà payée : le mode est ignoré côté serveur, on finalise directement.
    if (isPaid) {
      complete(currentPaymentMode ?? 'CASH');
      return;
    }
    setIsOpen(true);
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={handleClick}
        disabled={isPending}
      >
        <CheckCheck className="mr-1.5 h-4 w-4" />
        {label}
      </Button>

      {!isPaid && (
        <PaymentModal
          isOpen={isOpen}
          onClose={() => {
            setIsOpen(false);
            setError(null);
          }}
          orderRef={orderRef}
          amount={amount}
          isSubmitting={isPending}
          onConfirm={complete}
          error={error}
        />
      )}
    </>
  );
}
