'use client';

import { cn } from '@/lib/utils';

type Props = {
  value: number;
  criticalCount: number;
  muted?: boolean;
};

export function CountBadge({ value, criticalCount, muted }: Props) {
  const hasCritical = criticalCount > 0;
  return (
    <span
      className={cn(
        'relative min-w-5 rounded-full px-1.5 text-xs font-semibold tabular-nums',
        hasCritical
          ? 'bg-red-600 text-white'
          : muted
            ? 'bg-muted text-muted-foreground'
            : 'bg-foreground text-background'
      )}
    >
      {value}
      {hasCritical && (
        <span
          className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-background animate-pulse"
          aria-label={`${criticalCount} critique${criticalCount > 1 ? 's' : ''}`}
        />
      )}
    </span>
  );
}
