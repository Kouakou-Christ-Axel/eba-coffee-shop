'use client';

// Bouton « Encaisser l'acompte » — commande spéciale à l'avance (cf.
// `Order.depositRequired`). Distinct de `EncaisserButton` : ne solde jamais
// la commande, réutilise juste la même modale de paiement pour le montant
// restant à verser au titre de l'acompte.

import { useState, useTransition } from 'react';
import { Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PaymentModal, type PaymentLine } from '../caisse/payment-modal';
import { recordDepositAction } from './actions';

type Props = {
  orderId: string;
  orderRef: string;
  /** Montant restant à verser (depositRequired - depositPaid). */
  amount: number;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
};

export function AcompteButton({
  orderId,
  orderRef,
  amount,
  variant = 'outline',
  size = 'sm',
  className,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm(payments: PaymentLine[]) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await recordDepositAction(orderId, payments);
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
        <Wallet className="mr-1.5 h-4 w-4" />
        Encaisser l&apos;acompte
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
