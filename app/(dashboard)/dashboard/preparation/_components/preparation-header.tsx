'use client';

import { format } from 'date-fns';
import { Bell, BellOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConnectionBadge } from '@/lib/hooks/connection-badge';
import type { ConnState } from '@/lib/hooks/use-orders-stream';

type Props = {
  counts: { preparing: number; ready: number };
  connState: ConnState;
  lastSync: Date | null;
  soundEnabled: boolean;
  onToggleSound: () => void;
};

export function PreparationHeader({
  counts,
  connState,
  lastSync,
  soundEnabled,
  onToggleSound,
}: Props) {
  return (
    <div className="flex items-center justify-between border-b pb-3">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">
          {counts.preparing} en cuisine
        </span>
        {counts.ready > 0 && (
          <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-bold text-green-800 dark:bg-green-950 dark:text-green-100">
            {counts.ready} à remettre
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <ConnectionBadge state={connState} />
        {lastSync && (
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Synchro à {format(lastSync, 'HH:mm:ss')}
          </span>
        )}
        <button
          type="button"
          onClick={onToggleSound}
          aria-label={
            soundEnabled
              ? 'Désactiver le son des nouvelles commandes'
              : 'Activer le son des nouvelles commandes'
          }
          title={soundEnabled ? 'Son activé' : 'Son désactivé'}
          className={cn(
            'rounded-full p-2 transition-colors',
            soundEnabled
              ? 'bg-primary/10 text-primary hover:bg-primary/20'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          )}
        >
          {soundEnabled ? (
            <Bell className="h-4 w-4" />
          ) : (
            <BellOff className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
