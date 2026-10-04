// components/(public)/carte/_components/payment-breakdown.tsx
//
// Récapitulatif du montant avec paiement en ligne : le client voit la ligne de
// frais ET le total à payer AVANT de cliquer, jamais chez le fournisseur.

import { priceFormatter } from '@/config/menu';

type PaymentBreakdownProps = {
  /** Total net du panier (après récompense fidélité). */
  netTotal: number;
  /** Frais de paiement en ligne ; 0 = aucune ligne de frais. */
  fee: number;
  feePercent: number;
};

export function PaymentBreakdown({
  netTotal,
  fee,
  feePercent,
}: PaymentBreakdownProps) {
  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-foreground/10 pt-3 text-sm">
      {fee > 0 && (
        <div className="flex justify-between">
          <span className="text-foreground/60">
            Frais de paiement en ligne ({String(feePercent).replace('.', ',')}
            &nbsp;%)
          </span>
          <span className="font-medium">
            +{priceFormatter.format(fee)}&nbsp;F
          </span>
        </div>
      )}
      <div className="flex justify-between font-semibold">
        <span>Total à payer</span>
        <span className="text-primary">
          {priceFormatter.format(netTotal + fee)}&nbsp;F
        </span>
      </div>
    </div>
  );
}
