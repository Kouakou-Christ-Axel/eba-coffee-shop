'use client';

import { Chip } from '@heroui/react';
import type { PaymentSectionState } from './use-payment-section';

export function StatusChip({ kind }: { kind: PaymentSectionState['kind'] }) {
  return (
    <>
      {kind === 'paid' || kind === 'deposit_paid' || kind === 'nothing_due' ? (
        <Chip color="success" variant="flat" size="sm">
          {kind === 'paid'
            ? 'Paiement validé'
            : kind === 'deposit_paid'
              ? 'Acompte versé'
              : 'Rien à payer'}
        </Chip>
      ) : kind === 'late_paid' ? (
        <Chip color="warning" variant="flat" size="sm">
          Payée, commande annulée
        </Chip>
      ) : kind === 'failed' || kind === 'expired' ? (
        <Chip color="danger" variant="flat" size="sm">
          {kind === 'expired' ? 'Délai dépassé' : 'Paiement échoué'}
        </Chip>
      ) : kind === 'verifying' ? (
        <Chip color="warning" variant="flat" size="sm">
          Confirmation en cours
        </Chip>
      ) : (
        <Chip color="default" variant="flat" size="sm">
          En attente
        </Chip>
      )}
    </>
  );
}
