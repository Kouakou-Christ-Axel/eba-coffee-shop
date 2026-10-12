'use client';

import { Copy, Loader2, Pencil, Receipt, Trash2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { priceFmt } from './format';
import type { InvestmentRow } from './types';

export function InvestmentsRows({
  investments,
  pendingId,
  onEdit,
  onDuplicate,
  onRemove,
}: {
  investments: InvestmentRow[];
  pendingId: string | null;
  onEdit: (r: InvestmentRow) => void;
  onDuplicate: (r: InvestmentRow) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Montant</TableHead>
            <TableHead>Canal</TableHead>
            <TableHead>Financeur</TableHead>
            <TableHead>Remboursement</TableHead>
            <TableHead>Justif.</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {investments.map((i) => (
            <TableRow key={i.id}>
              <TableCell className="whitespace-nowrap font-mono text-sm">
                {i.date}
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{i.sourceName}</Badge>
              </TableCell>
              <TableCell className="tabular-nums">
                {priceFmt.format(i.amount)} F
              </TableCell>
              <TableCell className="text-sm">{i.paymentLabel}</TableCell>
              <TableCell className="text-sm">{i.financier ?? '—'}</TableCell>
              <TableCell className="text-sm">
                {!i.reimbursable ? (
                  <span className="text-muted-foreground">
                    Non remboursable
                  </span>
                ) : i.outstanding === 0 ? (
                  <Badge variant="outline" className="text-green-600">
                    Soldé
                  </Badge>
                ) : (
                  <span className="tabular-nums">
                    Reste {priceFmt.format(i.outstanding)} F
                  </span>
                )}
              </TableCell>
              <TableCell>
                {i.documentUrl ? (
                  <a
                    href={i.documentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-primary hover:underline"
                    aria-label="Voir le justificatif"
                  >
                    <Receipt className="h-4 w-4" />
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onEdit(i)}
                    aria-label="Modifier l’apport"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onDuplicate(i)}
                    aria-label="Dupliquer l’apport"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onRemove(i.id)}
                    disabled={pendingId === i.id}
                    aria-label="Supprimer l’apport"
                  >
                    {pendingId === i.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-destructive" />
                    )}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {investments.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={8}
                className="py-8 text-center text-sm text-muted-foreground"
              >
                Aucun apport sur cette sélection.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
