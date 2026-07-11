// Carte KPI partagée du dashboard (Vue d'ensemble + Statistiques), avec
// indicateur d'évolution optionnel vs une période de référence. Server
// component : markup pur, aucune interactivité.

import type { LucideIcon } from 'lucide-react';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const pctFormatter = new Intl.NumberFormat('fr-FR', {
  maximumFractionDigits: 0,
});

export type KpiDelta = {
  /**
   * Évolution (0.12 = +12 % ou +12 pts selon `unit`). null = référence vide,
   * affiché « — ».
   */
  pct: number | null;
  /** Libellé de la référence (ex. « vs 30 j précédents », « vs hier »). */
  label: string;
  /** Une hausse est-elle une bonne nouvelle ? false pour dépenses/annulations. */
  goodWhenUp?: boolean;
  /** « % » = évolution relative (défaut) ; « pts » = écart en points. */
  unit?: '%' | 'pts';
};

export function KpiCard({
  label,
  value,
  Icon,
  hint,
  valueClassName,
  subtle,
  delta,
}: {
  label: string;
  value: string;
  Icon: LucideIcon;
  hint?: string;
  valueClassName?: string;
  subtle?: boolean;
  delta?: KpiDelta;
}) {
  return (
    <div
      className={cn('rounded-xl border bg-card p-4', subtle && 'bg-muted/30')}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className={cn('mt-2 text-2xl font-bold tabular-nums', valueClassName)}>
        {value}
      </p>
      {delta && <DeltaBadge delta={delta} />}
      {hint && (
        <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

function DeltaBadge({ delta }: { delta: KpiDelta }) {
  const { pct, label, goodWhenUp = true, unit = '%' } = delta;

  if (pct === null) {
    return (
      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3.5 w-3.5" />
        <span>— {label}</span>
      </p>
    );
  }

  const up = pct > 0;
  const flat = Math.round(pct * 100) === 0;
  const TrendIcon = flat ? Minus : up ? TrendingUp : TrendingDown;
  const good = up === goodWhenUp;
  return (
    <p
      className={cn(
        'mt-0.5 flex items-center gap-1 text-xs tabular-nums',
        flat ? 'text-muted-foreground' : good ? 'text-green-600' : 'text-destructive'
      )}
    >
      <TrendIcon className="h-3.5 w-3.5" />
      <span>
        {up ? '+' : '−'}
        {pctFormatter.format(Math.abs(pct) * 100)} {unit} {label}
      </span>
    </p>
  );
}
