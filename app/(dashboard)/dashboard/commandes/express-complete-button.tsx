'use client';

// Bouton « Payer & récupérer » : finalise une commande en un clic (payée +
// récupérée). Si la commande n'est pas encore payée, ouvre la modale de paiement
// partagée pour choisir le mode ; si elle l'est déjà, c'est un bouton direct.
// Branche la server action `payAndCompleteAction` (qui revalide la page).

import { useState, useTransition } from 'react';
import { CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PaymentModal, type PaymentLine } from '../caisse/payment-modal';
import { payAndCompleteAction } from './actions';
import { useConfirmDialog } from '../_components/use-confirm-dialog';

type Props = {
  orderId: string;
  orderRef: string;
  amount: number;
  /** Commande déjà encaissée : pas de modale, finalisation directe. */
  isPaid?: boolean;
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
  variant = 'default',
  size = 'sm',
  className,
  label = 'Payer & récupérer',
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { confirm, confirmDialog } = useConfirmDialog();

  function complete(payments: PaymentLine[] | undefined) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await payAndCompleteAction(orderId, payments);
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

  async function handleClick() {
    // Déjà payée : `payments` est ignoré côté serveur, il n'y a donc aucune
    // modale pour rattraper un tap accidentel — et /commandes n'a pas le toast
    // d'annulation de la caisse. On confirme explicitement.
    if (isPaid) {
      const confirmed = await confirm({
        title: 'Marquer comme récupérée ?',
        message: `La commande ${orderRef} est déjà payée : elle sera finalisée immédiatement.`,
        confirmLabel: 'Marquer récupérée',
      });
      if (confirmed) complete(undefined);
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

      {error && isPaid && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

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

      {confirmDialog}
    </>
  );
}
