'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, Link2, Loader2, X } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
import { relinkExpenseItemAction } from './actions';

export type ArticleHistoryLine = {
  id: string;
  rawLabel: string;
  label: string | null;
  formatQty: number | null;
  formatSize: number | null;
  unit: string | null;
  unitPrice: number | null;
  amount: number;
  pendingQuantity: boolean;
  date: string;
  receiptNo: string | null;
  supplier: string | null;
  paymentMethod: string;
  categoryName: string;
};

type ArticleOption = { id: string; name: string };

const priceFmt = new Intl.NumberFormat('fr-FR');
const qtyFmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });

const selectClass =
  'h-8 rounded-md border border-input bg-transparent px-2 text-xs shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';

/**
 * Drill-down d'un article (« farine T45 ») : chaque achat avec sa dépense.
 * Ouvert quand `?article=` est présent ; la fermeture retire le paramètre.
 * Chaque ligne peut être re-rattachée à un autre article (correction d'un
 * rapprochement erroné) via `relinkExpenseItemAction`.
 */
export function ArticleHistorySheet({
  articleId,
  articleName,
  lines,
  articlesMeta,
}: {
  articleId: string;
  articleName: string;
  lines: ArticleHistoryLine[];
  /** Articles actifs disponibles comme cible de re-rattachement. */
  articlesMeta: ArticleOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [relinkingId, setRelinkingId] = useState<string | null>(null);
  const [relinkTarget, setRelinkTarget] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete('article');
    router.replace(sp.size > 0 ? `?${sp.toString()}` : '?', { scroll: false });
  }

  const relinkTargets = articlesMeta.filter((a) => a.id !== articleId);

  function startRelink(lineId: string) {
    setError(null);
    setRelinkingId(lineId);
    setRelinkTarget(relinkTargets[0]?.id ?? '');
  }

  function confirmRelink(lineId: string) {
    if (!relinkTarget) return;
    setError(null);
    startTransition(async () => {
      const r = await relinkExpenseItemAction(lineId, relinkTarget);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setRelinkingId(null);
      // La ligne re-rattachée doit disparaître de cet historique : on
      // redemande le rendu serveur (getExpenseArticleHistory pour cet
      // articleId, désormais sans cette ligne).
      router.refresh();
    });
  }

  const total = lines.reduce((s, l) => s + l.amount, 0);

  return (
    <Sheet open onOpenChange={(open) => !open && close()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{articleName}</SheetTitle>
          <SheetDescription>
            {lines.length} achat{lines.length > 1 ? 's' : ''} sur la sélection —{' '}
            {priceFmt.format(total)} F au total.
          </SheetDescription>
        </SheetHeader>
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
                          l.formatSize
                            ? ` × ${qtyFmt.format(l.formatSize)}`
                            : ''
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
      </SheetContent>
    </Sheet>
  );
}
