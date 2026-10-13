import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
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
import { dateFmt, IN_FLIGHT_LABELS, priceFmt } from './helpers';
import type { Ardoise } from './types';

export function ToCheckSection({ ardoise }: { ardoise: Ardoise }) {
  return (
    <section className="rounded-xl border border-dashed bg-muted/30 p-4">
      <h2 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-muted-foreground">
        <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />À
        vérifier
        <Badge variant="outline">
          {ardoise.toCheckCount} commande
          {ardoise.toCheckCount > 1 ? 's' : ''}
        </Badge>
        <Badge variant="outline">
          {priceFmt.format(ardoise.toCheckTotal)} F — non compté dans le total
          dû
        </Badge>
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Ces commandes ne sont pas payées et n’ont jamais été marquées comme
        récupérées : soit le retrait n’a pas été enregistré, soit elles
        devraient être annulées. Corrigez le statut sur la fiche commande — une
        fois marquée récupérée, la commande rejoint l’ardoise ci-dessus.
      </p>

      <div className="mt-3 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>N°</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Montant</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ardoise.toCheck.map((o) => (
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
                <TableCell className="text-sm">
                  {o.name ?? 'Client anonyme'}
                  {o.phone && (
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      {formatPhoneForDisplay(o.phone)}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {IN_FLIGHT_LABELS[o.status] ?? o.status}
                  </Badge>
                </TableCell>
                <TableCell className="tabular-nums">
                  {priceFmt.format(o.total)} F
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
