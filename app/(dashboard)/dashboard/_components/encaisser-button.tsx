'use client';

// Bouton « Encaisser » réutilisable (commandes, ardoise, cuisine). Ouvre la
// modale de paiement partagée avec la caisse. L'action serveur à appeler est
// injectée via `action` (défaut : `markOrderPaidAction`, caisse) — la cuisine
// passe `markOrderPaidFromKitchen` pour encaisser sans les droits caisse.

import { useState, useTransition } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PaymentModal, type PaymentLine } from '../caisse/payment-modal';
import { markOrderPaidAction } from '../commandes/actions';
import { useShortageConfirm } from './use-shortage-confirm';
import type { ShortageLine } from '@/lib/orders/shortage';

export type EncaisserAction = (
  orderId: string,
  payments: PaymentLine[],
  opts?: { coverShortage?: boolean }
) => Promise<{ error: string; shortage?: ShortageLine[] } | undefined>;

type Props = {
  orderId: string;
  orderRef: string;
  amount: number;
  action?: EncaisserAction;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
  label?: string;
};

export function EncaisserButton({
  orderId,
  orderRef,
  amount,
  action = markOrderPaidAction,
  variant = 'default',
  size = 'sm',
  className,
  label = 'Encaisser',
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { confirmShortage, shortageDialog } = useShortageConfirm();

  function handleConfirm(payments: PaymentLine[]) {
    setError(null);
    startTransition(async () => {
      try {
        let result = await action(orderId, payments);
        // Pénurie : on propose d'enregistrer la production sur place plutôt que
        // de renvoyer le staff corriger le stock dans le menu.
        if (
          result?.shortage?.length &&
          (await confirmShortage(result.shortage))
        ) {
          result = await action(orderId, payments, { coverShortage: true });
        }
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

      {shortageDialog}
    </>
  );
}
