'use client';

import { Check, Link2, Loader2, X } from 'lucide-react';
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
import { priceFmt, qtyFmt } from './format';
import type { ArticleHistoryLine, ArticleOption } from './types';
import { useRelink } from './use-relink';

const selectClass =
  'h-8 rounded-md border border-input bg-transparent px-2 text-xs shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';

export function HistoryLinesTable({
  articleId,
  articlesMeta,
  lines,
}: {
  articleId: string;
  articlesMeta: ArticleOption[];
  lines: ArticleHistoryLine[];
}) {
  const {
    relinkingId,
    setRelinkingId,
    relinkTarget,
    setRelinkTarget,
    error,
    pending,
    relinkTargets,
    startRelink,
    confirmRelink,
  } = useRelink(articleId, articlesMeta);

  return (
    <div className="px-4 pb-4 space-y-2">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>N° reçu</TableHead>
            <TableHead className="text-right">Qté</TableHead>
            <TableHead className="text-right">PU</TableHead>
            <TableHead className="text-right">Montant</TableHead>
            <TableHead>Fournisseur</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((l) => (
            <TableRow key={l.id}>
              <TableCell className="whitespace-nowrap font-mono text-sm">
                {l.date}
              </TableCell>
              <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                {l.receiptNo ?? '—'}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {l.formatQty != null
                  ? `${qtyFmt.format(l.formatQty)}${
                      l.formatSize ? ` × ${qtyFmt.format(l.formatSize)}` : ''
                    } ${l.unit ?? ''}`.trim()
                  : '—'}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {l.unitPrice != null
                  ? `${priceFmt.format(l.unitPrice)} F`
                  : '—'}
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {priceFmt.format(l.amount)} F
                {l.pendingQuantity && (
                  <Badge variant="outline" className="ml-1.5 text-[10px]">
                    qté à renseigner
                  </Badge>
                )}
              </TableCell>
              <TableCell className="max-w-[140px] truncate text-sm text-muted-foreground">
                {l.supplier ?? '—'}
              </TableCell>
              <TableCell className="text-right">
                {relinkingId === l.id ? (
                  <div className="flex items-center justify-end gap-1">
                    <select
                      className={selectClass}
                      value={relinkTarget}
                      onChange={(e) => setRelinkTarget(e.target.value)}
                      disabled={pending}
                      aria-label="Nouvel article"
                    >
                      {relinkTargets.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      onClick={() => confirmRelink(l.id)}
                      disabled={pending || !relinkTarget}
                      aria-label="Confirmer le re-rattachement"
                    >
                      {pending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      onClick={() => setRelinkingId(null)}
                      aria-label="Annuler"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => startRelink(l.id)}
                    disabled={relinkTargets.length === 0}
                    aria-label="Re-lier cette ligne à un autre article"
                  >
                    <Link2 className="h-4 w-4" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
          {lines.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={7}
                className="py-8 text-center text-sm text-muted-foreground"
              >
                Aucun achat sur cette sélection.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
