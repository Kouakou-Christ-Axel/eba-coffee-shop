'use client';

// Liste des remboursements : tableau sur grand écran, cartes sur mobile. Un clic
// ouvre le détail (`?open=<id>`, lien partageable).

import { useQueryState } from 'nuqs';
import { parseAsString } from 'nuqs';
import { PaymentMethodIcon } from '@/components/payment-method-badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatAbidjanDateTime } from '@/lib/timezone';
import { PAYMENT_MODE_LABELS } from '@/lib/payment-modes';
import { REFUND_REASON_LABELS } from '@/lib/schemas/refund';
import { REFUND_DELIVERY_LABELS } from '@/lib/refunds/labels';
import { RefundStatusBadge } from './refund-badges';
import type { RefundRowData } from './refund-types';

const fmt = new Intl.NumberFormat('fr-FR');

function useOpenRefund() {
  return useQueryState(
    'open',
    parseAsString.withOptions({ shallow: false, scroll: false })
  );
}

function Channel({ row }: { row: RefundRowData }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <PaymentMethodIcon mode={row.channel} className="h-4 w-4" />
      <span>
        {PAYMENT_MODE_LABELS[row.channel]}
        <span className="block text-xs text-muted-foreground">
          {REFUND_DELIVERY_LABELS[row.delivery]}
        </span>
      </span>
    </span>
  );
}

export function RefundsList({ rows }: { rows: RefundRowData[] }) {
  const [, setOpen] = useOpenRefund();
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Demandé le</TableHead>
              <TableHead>Commande</TableHead>
              <TableHead>Client</TableHead>
              <TableHead className="text-right">Montant</TableHead>
              <TableHead>Motif</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow
                key={r.id}
                tabIndex={0}
                role="button"
                aria-label={`Ouvrir le remboursement de ${fmt.format(r.amount)} F`}
                className="cursor-pointer"
                onClick={() => setOpen(r.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setOpen(r.id);
                  }
                }}
              >
                <TableCell className="whitespace-nowrap text-sm">
                  {formatAbidjanDateTime(new Date(r.createdAt))}
                </TableCell>
                <TableCell className="font-mono text-sm">
                  #{String(r.dailyNumber).padStart(3, '0')}
                </TableCell>
                <TableCell>{r.customerName ?? '—'}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {fmt.format(r.amount)} F
                </TableCell>
                <TableCell className="text-sm">
                  {REFUND_REASON_LABELS[r.reason]}
                </TableCell>
                <TableCell>
                  <Channel row={r} />
                </TableCell>
                <TableCell>
                  <RefundStatusBadge status={r.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="space-y-3 md:hidden">
        {rows.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => setOpen(r.id)}
              className="w-full rounded-xl border bg-card p-4 text-left shadow-xs"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-bold tabular-nums">
                    {fmt.format(r.amount)} F
                  </p>
                  <p className="text-sm text-muted-foreground">
                    #{String(r.dailyNumber).padStart(3, '0')}
                    {r.customerName ? ` · ${r.customerName}` : ''}
                  </p>
                </div>
                <RefundStatusBadge status={r.status} />
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>{REFUND_REASON_LABELS[r.reason]}</span>
                <Channel row={r} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatAbidjanDateTime(new Date(r.createdAt))}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
