'use client';

// Barre de filtres de la page Jèko : compte (Tous / A / B) et plage de dates, dans
// l'URL (nuqs). Une seule transition partagée : les deux contrôles restent réactifs
// et la page s'atténue pendant le chargement.

import { useTransition } from 'react';
import { useQueryStates } from 'nuqs';
import { Button } from '@/components/ui/button';
import {
  DateRangeFilter,
  type RangePreset,
} from '@/components/(dashboard)/date-range-filter';
import type { JekoAccount } from '@/lib/jeko/accounts';
import { rangeChangeToParams } from '@/lib/url-state/shared-params';
import { cn } from '@/lib/utils';
import { jekoParsers } from './search-params';

const PRESETS: RangePreset[] = [
  { label: "Aujourd'hui", days: 1 },
  { label: '7 jours', days: 7 },
  { label: 'Ce mois', kind: 'month' },
  { label: '30 jours', days: 30 },
];

export function JekoToolbar({
  accounts,
  from,
  to,
  isAll,
}: {
  /** Comptes proposés au filtre. */
  accounts: JekoAccount[];
  from: string;
  to: string;
  isAll: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [params, setParams] = useQueryStates(jekoParsers, {
    shallow: false,
    history: 'push',
    scroll: false,
    startTransition,
  });

  return (
    <div
      aria-busy={isPending}
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 transition-opacity',
        isPending && 'pointer-events-none opacity-60'
      )}
    >
      <div
        role="group"
        aria-label="Compte Jèko"
        className="flex items-center gap-1"
      >
        {[null, ...accounts].map((a) => (
          <Button
            key={a ?? 'all'}
            size="sm"
            variant={params.account === a ? 'default' : 'outline'}
            aria-pressed={params.account === a}
            onClick={() => setParams({ account: a })}
          >
            {a ? `Compte ${a}` : 'Tous les comptes'}
          </Button>
        ))}
      </div>
      <DateRangeFilter
        from={from}
        to={to}
        isAll={isAll}
        presets={PRESETS}
        onRangeChange={(next) => {
          // Pas de pagination ici : on retire le `page` du patch partagé.
          const patch = { ...rangeChangeToParams(next), page: undefined };
          void setParams(patch);
        }}
      />
    </div>
  );
}
