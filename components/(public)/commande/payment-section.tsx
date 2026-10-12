'use client';

// components/(public)/commande/payment-section.tsx
//
// Bloc « Paiement » de la page publique de suivi (/commande/:id). Le client paie
// en ligne via Jèko (Wave, Orange, MTN, Moov, Djamo) puis revient ici. La logique
// de décision (quel état, compte à rebours, messages) vit dans
// lib/orders/payment-panel.ts, testée ; ce composant n'ajoute que le JSX et les
// appels réseau.
//
// États (cf. `PaymentPanelKind`) :
//   - pending      : compte à rebours, choix du moyen, « Payer … F » ;
//   - verifying    : de retour de chez Jèko avec succès, on confirme ;
//   - failed       : retour avec échec, le client peut réessayer ;
//   - expired      : délai dépassé, il faut recommander ;
//   - paid / late_paid / nothing_due / deposit_paid : issues positives ;
//   - counter      : aucun paiement en ligne, on règle au comptoir.

import { Wallet } from 'lucide-react';
import type { PublicOrderView } from '@/lib/orders';
import type { PaymentReturn } from '@/lib/orders/payment-panel';
import { PaymentPanels } from './payment/payment-panels';
import { StatusChip } from './payment/status-chip';
import { usePaymentSection } from './payment/use-payment-section';

export function PaymentSection({
  order,
  whatsapp,
  paymentReturn,
  onRefresh,
}: {
  order: PublicOrderView;
  whatsapp: string;
  /** Retour de chez Jèko lu dans `?paiement=` (null = arrivée normale). */
  paymentReturn: PaymentReturn;
  /** Recharge la commande (après une vérification ou un paiement relancé). */
  onRefresh: () => void;
}) {
  const payment = usePaymentSection({
    order,
    whatsapp,
    paymentReturn,
    onRefresh,
  });

  return (
    <div className="rounded-xl border border-foreground/10 bg-default-50 p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground/40">
          <Wallet className="h-4 w-4" />
          Paiement
        </p>
        <StatusChip kind={payment.kind} />
      </div>

      <PaymentPanels
        order={order}
        paymentReturn={paymentReturn}
        payment={payment}
      />
    </div>
  );
}
