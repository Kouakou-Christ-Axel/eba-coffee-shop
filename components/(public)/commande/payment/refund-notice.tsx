import { RotateCcw } from 'lucide-react';
import { priceFormatter } from '@/config/menu';

/**
 * Remboursement visible par le client sur sa page de suivi : ce qui lui a déjà
 * été rendu, et ce qui est en cours (validation ou transfert). Rien à afficher
 * sans remboursement.
 */
export function RefundNotice({
  refunds,
}: {
  refunds: { paid: number; pending: number };
}) {
  if (refunds.paid <= 0 && refunds.pending <= 0) return null;
  return (
    <div
      role="status"
      className="mt-4 flex items-start gap-2 rounded-lg bg-default-100 px-3 py-3 text-sm"
    >
      <RotateCcw className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="space-y-0.5">
        {refunds.paid > 0 && (
          <p className="font-medium">
            Remboursé : {priceFormatter.format(refunds.paid)} F
          </p>
        )}
        {refunds.pending > 0 && (
          <p className="text-foreground/70">
            Remboursement en cours : {priceFormatter.format(refunds.pending)} F.
            Tu seras prévenu dès qu’il est parti.
          </p>
        )}
      </div>
    </div>
  );
}
