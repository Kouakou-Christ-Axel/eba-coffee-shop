import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefundStatusBadge } from '../../../remboursements/_components/refund-badges';
import {
  RequestRefundSheet,
  type RefundOrderInfo,
} from '../../../remboursements/_components/request-refund-sheet';
import { REFUND_REASON_LABELS } from '@/lib/schemas/refund';
import { REFUND_DELIVERY_LABELS } from '@/lib/refunds/labels';
import type { RefundListItem } from '@/lib/refunds/queries';

const fmt = new Intl.NumberFormat('fr-FR');

/** Remboursements de la commande + bouton « Rembourser » (équipe caisse). */
export function OrderRefundsCard({
  refunds,
  refundOrder,
  canRequest,
  canApprove,
  openSheet,
}: {
  refunds: RefundListItem[];
  refundOrder: RefundOrderInfo;
  canRequest: boolean;
  canApprove: boolean;
  openSheet: boolean;
}) {
  if (refunds.length === 0 && !canRequest) return null;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">Remboursements</CardTitle>
        {canRequest && (
          <RequestRefundSheet
            order={refundOrder}
            canApprove={canApprove}
            defaultOpen={openSheet}
          />
        )}
      </CardHeader>
      <CardContent>
        {refunds.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun remboursement sur cette commande.
          </p>
        ) : (
          <ul className="divide-y">
            {refunds.map((r) => (
              <li key={r.id} className="py-2">
                <Link
                  href={`/dashboard/remboursements?open=${r.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm hover:underline"
                >
                  <span className="font-semibold tabular-nums">
                    {fmt.format(r.amount)} F
                    <span className="ml-2 font-normal text-muted-foreground">
                      {REFUND_REASON_LABELS[r.reason]} ·{' '}
                      {REFUND_DELIVERY_LABELS[r.delivery]}
                    </span>
                  </span>
                  <RefundStatusBadge status={r.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
