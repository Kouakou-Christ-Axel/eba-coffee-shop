import Link from 'next/link';
import { Handshake } from 'lucide-react';
import { formatPhoneForDisplay } from '@/lib/phone';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { EncaisserButton } from '../../_components/encaisser-button';
import { dateFmt, formatDebtAge, priceFmt } from './helpers';
import type { ArdoiseGroup } from './types';

export function DebtGroup({ g, now }: { g: ArdoiseGroup; now: Date }) {
  return (
    <details className="group rounded-xl border bg-card open:shadow-sm">
      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            {g.customerId ? (
              <Link
                href={`/dashboard/clients/${g.customerId}`}
                className="hover:underline"
              >
                {g.name ?? 'Client'}
              </Link>
            ) : (
              <span>{g.name ?? 'Client anonyme'}</span>
            )}
            {g.isTrusted && (
              <Badge className="bg-blue-600">
                <Handshake className="h-3 w-3" aria-hidden="true" />
                Confiance
              </Badge>
            )}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {g.phone ? (
              <span className="font-mono">
                {formatPhoneForDisplay(g.phone)}
              </span>
            ) : (
              'Sans téléphone'
            )}{' '}
            · {g.ordersCount} commande{g.ordersCount > 1 ? 's' : ''} · depuis{' '}
            {formatDebtAge(g.oldestUnpaidAt, now)}
          </p>
        </div>
        <span className="shrink-0 text-lg font-bold tabular-nums">
          {priceFmt.format(g.totalOwed)} F
        </span>
      </summary>

      <div className="overflow-x-auto border-t px-4 py-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>N°</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Type</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {g.orders.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="text-sm">
                  {dateFmt.format(o.createdAt)}
                </TableCell>
                <TableCell className="font-mono text-sm">
                  <Link
                    href={`/dashboard/commandes/${o.id}`}
                    className="hover:underline"
                  >
                    #{String(o.dailyNumber).padStart(3, '0')}
                  </Link>
                </TableCell>
                <TableCell className="tabular-nums">
                  {priceFmt.format(o.total)} F
                </TableCell>
                <TableCell>
                  {o.isOnAccount ? (
                    <Badge variant="secondary">Ardoise</Badge>
                  ) : (
                    <Badge variant="outline">Impayée</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <EncaisserButton
                    orderId={o.id}
                    orderRef={`#${String(o.dailyNumber).padStart(3, '0')}`}
                    amount={o.total}
                    variant="outline"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </details>
  );
}
