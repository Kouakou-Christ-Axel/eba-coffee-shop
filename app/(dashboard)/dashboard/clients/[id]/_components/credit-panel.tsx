import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CreditEntryKind } from '@/generated/prisma/client';
import { formatAbidjanDateTime } from '@/lib/timezone';
import { priceFmt } from './helpers';

const KIND_LABELS: Record<CreditEntryKind, string> = {
  ISSUED: 'Avoir émis',
  SPENT: 'Utilisé sur une commande',
  RESTORED: 'Rendu',
  CONVERTED: 'Converti en argent',
  ADJUSTED: 'Correction',
};

export type CreditPanelEntry = {
  id: string;
  kind: CreditEntryKind;
  delta: number;
  balanceAfter: number;
  note: string | null;
  refundId: string | null;
  createdAt: Date;
};

/** Solde d'avoir du client et ses derniers mouvements. */
export function CreditPanel({
  balance,
  entries,
}: {
  balance: number;
  entries: CreditPanelEntry[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Avoir</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold tabular-nums">
            {priceFmt.format(balance)} F
          </span>
          <span className="text-sm text-muted-foreground">
            disponibles sur ses prochaines commandes
          </span>
        </div>
        {entries.length > 0 && (
          <ul className="divide-y rounded-lg border text-sm">
            {entries.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
              >
                <span>
                  {KIND_LABELS[e.kind]}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {formatAbidjanDateTime(e.createdAt)}
                  </span>
                  {e.refundId && (
                    <Link
                      href={`/dashboard/remboursements?open=${e.refundId}`}
                      className="ml-2 text-xs underline-offset-2 hover:underline"
                    >
                      Voir le remboursement
                    </Link>
                  )}
                </span>
                <span className="tabular-nums">
                  <span
                    className={
                      e.delta > 0 ? 'font-medium text-green-600' : 'font-medium'
                    }
                  >
                    {e.delta > 0 ? '+' : '−'}
                    {priceFmt.format(Math.abs(e.delta))} F
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    solde {priceFmt.format(e.balanceAfter)} F
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
