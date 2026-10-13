'use client';

import type { buildArticleAnalytics } from '@/lib/expense-article-analytics';
import { ArticlePriceTrendChart } from '@/components/(dashboard)/charts/article-price-trend-chart';
import { ArticleMonthlyChart } from '@/components/(dashboard)/charts/article-monthly-chart';
import { ArticleSupplierPriceChart } from '@/components/(dashboard)/charts/article-supplier-price-chart';
import { priceFmt, qtyFmt } from './format';

type Analytics = ReturnType<typeof buildArticleAnalytics>;

/**
 * Fiche d'analyse d'un article (au-dessus du journal) : KPIs de prix + réappro,
 * courbe du prix unitaire, quantités/montants par mois, prix par fournisseur.
 */
export function ArticleAnalyticsPanel({
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
