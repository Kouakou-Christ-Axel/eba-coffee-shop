'use client';

import type { ProductRow } from './types';
import { Badge } from '@/components/ui/badge';
import {
  isPausedNow,
  isWithinAnyPeriod,
  nextUpcomingPeriod,
} from '@/lib/supplements';
import { formatAbidjanDateTime, formatAbidjanShortDate } from '@/lib/timezone';

export function ProductStatusBadges({ product: p }: { product: ProductRow }) {
  const special = (() => {
    if (p.weeklySpecialPeriods.length === 0) return null;
    if (isWithinAnyPeriod(p.weeklySpecialPeriods)) {
      return (
        <Badge
          variant="outline"
          className="border-emerald-400 text-emerald-700 dark:text-emerald-400"
        >
          Spécialité de la semaine
        </Badge>
      );
    }
    const next = nextUpcomingPeriod(p.weeklySpecialPeriods);
    if (!next) return null;
    return (
      <Badge variant="outline">
        Revient le {formatAbidjanShortDate(next.startDate)}
      </Badge>
    );
  })();

  return (
    <>
      <Badge variant={p.available ? 'default' : 'outline'}>
        {p.available ? 'Visible' : 'Masqué'}
      </Badge>
      {p.featured && (
        <Badge variant="secondary">★ {p.featuredBadge ?? 'Favori'}</Badge>
      )}
      {isPausedNow(p.unavailableUntil) && p.unavailableUntil && (
        <Badge
          variant="outline"
          className="border-amber-400 text-amber-700 dark:text-amber-400"
          title={`Reprise le ${formatAbidjanDateTime(p.unavailableUntil)}`}
        >
          En pause
        </Badge>
      )}
      {p.scheduleName && (
        <Badge variant="outline" title="Planning récurrent">
          {p.scheduleName}
        </Badge>
      )}
      {special}
    </>
  );
}
