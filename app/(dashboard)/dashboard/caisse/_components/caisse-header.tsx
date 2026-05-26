'use client';

import Link from 'next/link';
import { Bell, BellOff, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConnectionBadge } from '@/lib/hooks/connection-badge';
import type { ConnState } from '@/lib/hooks/use-orders-stream';

type Props = {
  cashierName: string;
  connState: ConnState;
  soundEnabled: boolean;
  onToggleSound: () => void;
};

export function CaisseHeader({
  cashierName,
  connState,
  soundEnabled,
  onToggleSound,
}: Props) {
  return (
    <header className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Caisse · {cashierName}
        </p>
        <h1 className="truncate text-2xl font-bold">eba coffee</h1>
      </div>
      <div className="flex items-center gap-2">
        <ConnectionBadge state={connState} />
        <button
          type="button"
          onClick={onToggleSound}
          aria-label={soundEnabled ? 'Désactiver le son' : 'Activer le son'}
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
        <Link
          href="/dashboard/caisse/new"
          aria-label="Nouvelle commande"
          className="rounded-full bg-primary p-2 text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
        </Link>
      </div>
    </header>
  );
}
