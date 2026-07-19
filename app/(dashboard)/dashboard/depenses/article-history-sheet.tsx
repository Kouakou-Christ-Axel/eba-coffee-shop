'use client';

import { useMemo, useState, useTransition } from 'react';
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
import { buildArticleAnalytics } from '@/lib/expense-article-analytics';
import { ArticlePriceTrendChart } from '@/components/(dashboard)/charts/article-price-trend-chart';
import { ArticleMonthlyChart } from '@/components/(dashboard)/charts/article-monthly-chart';
import { ArticleSupplierPriceChart } from '@/components/(dashboard)/charts/article-supplier-price-chart';
import { relinkExpenseItemAction } from './actions';

export type ArticleHistoryLine = {
  id: string;
  rawLabel: string;
  label: string | null;
  qtyBase: number | null;
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
  baseUnit,
  wholesaleRefPrice,
  today,
  lines,
  articlesMeta,
}: {
  articleId: string;
  articleName: string;
  baseUnit: string | null;
  wholesaleRefPrice: number | null;
  /** Jour civil courant (YYYY-MM-DD, Abidjan) pour l'estimation de réappro. */
  today: string;
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

  const analytics = useMemo(
    () =>
      buildArticleAnalytics(
        lines.map((l) => ({
          date: l.date,
          amount: l.amount,
          qtyBase: l.qtyBase,
          supplier: l.supplier,
        })),
        today
      ),
    [lines, today]
  );

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
        <ArticleAnalyticsPanel
          analytics={analytics}
          baseUnit={baseUnit}
          wholesaleRefPrice={wholesaleRefPrice}
        />
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

type Analytics = ReturnType<typeof buildArticleAnalytics>;

/**
 * Fiche d'analyse d'un article (au-dessus du journal) : KPIs de prix + réappro,
 * courbe du prix unitaire, quantités/montants par mois, prix par fournisseur.
 */
function ArticleAnalyticsPanel({
  analytics: a,
  baseUnit,
  wholesaleRefPrice,
}: {
  analytics: Analytics;
  baseUnit: string | null;
  wholesaleRefPrice: number | null;
}) {
  if (a.lineCount === 0) return null;

  const unitSuffix = baseUnit ? `/${baseUnit}` : '';
  const qtyData = a.monthly.map((m) => ({ month: m.month, value: m.qty }));
  const amountData = a.monthly.map((m) => ({
    month: m.month,
    value: m.amount,
  }));
  const showSupplier = a.bySupplier.length >= 2;

  const changeHint =
    a.priceChangePct != null
      ? `${a.priceChangePct > 0 ? '+' : ''}${a.priceChangePct} % depuis le 1ᵉʳ`
      : undefined;
  const changeTone =
    a.priceChangePct == null || a.priceChangePct === 0
      ? 'flat'
      : a.priceChangePct > 0
        ? 'up'
        : 'down';

  const reorder =
    a.dueInDays == null
      ? '—'
      : a.dueInDays < 0
        ? `en retard de ${-a.dueInDays} j`
        : `~${a.dueInDays} j`;
  const reorderHint =
    a.daysSinceLast != null
      ? `${a.daysSinceLast} j depuis le dernier`
      : undefined;

  return (
    <div className="space-y-4 border-b px-4 pb-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi
          label="Prix moyen"
          value={
            a.avgUnitPrice != null
              ? `${priceFmt.format(a.avgUnitPrice)} F${unitSuffix}`
              : '—'
          }
        />
        <Kpi
          label="Dernier prix"
          value={
            a.lastUnitPrice != null
              ? `${priceFmt.format(a.lastUnitPrice)} F${unitSuffix}`
              : '—'
          }
          hint={changeHint}
          tone={changeTone}
        />
        <Kpi
          label="Min – Max"
          value={
            a.minUnitPrice != null && a.maxUnitPrice != null
              ? `${priceFmt.format(a.minUnitPrice)} – ${priceFmt.format(a.maxUnitPrice)}`
              : '—'
          }
        />
        <Kpi
          label="Réappro estimé"
          value={reorder}
          hint={reorderHint}
          tone={a.dueInDays != null && a.dueInDays < 0 ? 'up' : 'flat'}
        />
      </div>

      {a.missingQtyCount > 0 && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          {a.missingQtyCount} / {a.lineCount} ligne
          {a.missingQtyCount > 1 ? 's' : ''} sans quantité — renseigne-les pour
          fiabiliser les prix et quantités.
        </p>
      )}

      <div>
        <h4 className="mb-1 text-xs font-medium text-muted-foreground">
          Prix unitaire dans le temps
        </h4>
        <ArticlePriceTrendChart
          data={a.pricePoints}
          baseUnit={baseUnit}
          refPrice={wholesaleRefPrice}
          avgPrice={a.avgUnitPrice}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h4 className="mb-1 text-xs font-medium text-muted-foreground">
            Quantité achetée / mois{baseUnit ? ` (${baseUnit})` : ''}
          </h4>
          <ArticleMonthlyChart
            data={qtyData}
            label={`Quantité${baseUnit ? ` (${baseUnit})` : ''}`}
            color="var(--chart-2)"
            valueFormatter={(v) => qtyFmt.format(v)}
            emptyText="Aucune quantité renseignée."
          />
        </div>
        <div>
          <h4 className="mb-1 text-xs font-medium text-muted-foreground">
            Montant dépensé / mois (F)
          </h4>
          <ArticleMonthlyChart data={amountData} label="Montant (F)" />
        </div>
      </div>

      {showSupplier && (
        <div>
          <h4 className="mb-1 text-xs font-medium text-muted-foreground">
            Prix moyen par fournisseur
          </h4>
          <ArticleSupplierPriceChart data={a.bySupplier} baseUnit={baseUnit} />
        </div>
      )}
    </div>
  );
}

/** Petite tuile KPI (libellé + valeur + variation optionnelle colorée). */
function Kpi({
  label,
  value,
  hint,
  tone = 'flat',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'up' | 'down' | 'flat';
}) {
  const toneClass =
    tone === 'up'
      ? 'text-red-600 dark:text-red-400'
      : tone === 'down'
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-muted-foreground';
  return (
    <div className="rounded-md border p-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
      {hint && <p className={`text-[11px] ${toneClass}`}>{hint}</p>}
    </div>
  );
}
