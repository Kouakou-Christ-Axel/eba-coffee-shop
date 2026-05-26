'use client';

import { format } from 'date-fns';
import { Bell, BellOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConnectionBadge } from '@/lib/hooks/connection-badge';
import type { ConnState } from '@/lib/hooks/use-orders-stream';

type Props = {
  position: { index: number; total: number } | null;
  connState: ConnState;
  lastSync: Date | null;
  soundEnabled: boolean;
  onToggleSound: () => void;
};

export function PreparationHeader({
  position,
  connState,
  lastSync,
  soundEnabled,
  onToggleSound,
}: Props) {
  return (
    <div className="flex items-center justify-between border-b pb-3">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">
          Commande
        </span>
        {position ? (
          <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">
            {position.index + 1} / {position.total}
          </span>
        ) : (
          <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
            0 / 0
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
