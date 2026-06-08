'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  todayDateString,
  shiftDateString,
} from '@/lib/timezone';

export type RangePreset = {
  label: string;
  /** Nombre de jours dans la fenêtre (1 = aujourd'hui seul). */
  days: number;
};

type Props = {
  /** Borne basse courante (YYYY-MM-DD) résolue côté serveur. */
  from: string;
  /** Borne haute courante (YYYY-MM-DD) résolue côté serveur. */
  to: string;
  /** True si l'utilisateur a sélectionné « Tout » (aucune borne). */
  isAll: boolean;
  /** Préréglages rapides affichés (ex. Aujourd'hui, 7 j, 30 j). */
  presets?: RangePreset[];
  /** Affiche le bouton « Tout » (pas de filtre de date). */
  allowAll?: boolean;
  /** Affiche les flèches jour précédent / suivant (mode jour unique). */
  showDayNav?: boolean;
};

const DEFAULT_PRESETS: RangePreset[] = [
  { label: "Aujourd'hui", days: 1 },
  { label: '7 jours', days: 7 },
  { label: '30 jours', days: 30 },
];

export function DateRangeFilter({
  from,
  to,
  isAll,
  presets = DEFAULT_PRESETS,
  allowAll = true,
  showDayNav = false,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function apply(next: { from?: string; to?: string; all?: boolean }) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('page');
    if (next.all) {
      params.set('range', 'all');
      params.delete('from');
      params.delete('to');
    } else {
      params.delete('range');
      if (next.from) params.set('from', next.from);
      if (next.to) params.set('to', next.to);
    }
    router.push(`?${params.toString()}`);
  }

  function applyPreset(days: number) {
    const today = todayDateString();
    const start = days <= 1 ? today : shiftDateString(today, -(days - 1));
    apply({ from: start, to: today });
  }

  const isSingleDay = !isAll && from === to;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showDayNav && (
        <Button
          variant="outline"
          size="sm"
          disabled={isAll}
          onClick={() => {
            const d = shiftDateString(isSingleDay ? from : to, -1);
            apply({ from: d, to: d });
          }}
          aria-label="Jour précédent"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}

      <div className="relative">
        <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="date"
          aria-label="Date de début"
          value={isAll ? '' : from}
          max={isAll ? undefined : to || undefined}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) {
              if (allowAll) apply({ all: true });
              return;
            }
            // Si la nouvelle borne basse dépasse la borne haute, on aligne.
            const nextTo = !isAll && to && v > to ? v : to || v;
            apply({ from: v, to: nextTo });
          }}
          className="pl-8 pr-2 h-9 w-[150px]"
        />
      </div>

      <span className="text-xs text-muted-foreground">→</span>

      <div className="relative">
        <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="date"
          aria-label="Date de fin"
          value={isAll ? '' : to}
          min={isAll ? undefined : from || undefined}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) {
              if (allowAll) apply({ all: true });
              return;
            }
            const nextFrom = !isAll && from && v < from ? v : from || v;
            apply({ from: nextFrom, to: v });
          }}
          className="pl-8 pr-2 h-9 w-[150px]"
        />
      </div>

      {showDayNav && (
        <Button
          variant="outline"
          size="sm"
          disabled={isAll}
          onClick={() => {
            const d = shiftDateString(isSingleDay ? from : to, +1);
            apply({ from: d, to: d });
          }}
          aria-label="Jour suivant"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}

      {presets.map((p) => (
        <Button
          key={p.label}
          variant="ghost"
          size="sm"
          onClick={() => applyPreset(p.days)}
        >
          {p.label}
        </Button>
      ))}

      {allowAll && (
        <Button
          variant={isAll ? 'default' : 'ghost'}
          size="sm"
          onClick={() => apply({ all: true })}
        >
          Tout
        </Button>
      )}
    </div>
  );
}
