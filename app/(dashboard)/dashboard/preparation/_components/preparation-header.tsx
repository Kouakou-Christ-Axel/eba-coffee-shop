'use client';

import { format } from 'date-fns';
import {
  Bell,
  BellOff,
  CalendarClock,
  ClipboardList,
  PackageCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConnectionBadge } from '@/lib/hooks/connection-badge';
import type { ConnState } from '@/lib/hooks/use-orders-stream';

type Props = {
  counts: {
    cooking: number;
    scheduled: number;
    ready: number;
    /** Quantité d'articles à produire pour le premier jour chargé du plan. */
    production: number;
  };
  /** Au moins une commande prête dépasse le seuil d'attente (signal rouge). */
  readyAlert: boolean;
  /** Commandes programmées dont le retrait approche sans lancement en cuisine. */
  toLaunchCount: number;
  connState: ConnState;
  lastSync: Date | null;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenScheduled: () => void;
  onOpenReady: () => void;
  onOpenProduction: () => void;
};

export function PreparationHeader({
  counts,
  readyAlert,
  toLaunchCount,
  connState,
  lastSync,
  soundEnabled,
  onToggleSound,
  onOpenScheduled,
  onOpenReady,
  onOpenProduction,
}: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">
          {counts.cooking} à cuisiner
        </span>

        {/* Programmées : retrait lointain OU pas encore lancées en cuisine.
            Vire au rouge dès qu'une d'elles doit être lancée maintenant — sans
            ça, l'échéance passerait inaperçue derrière un panneau replié. */}
        <button
          type="button"
          onClick={onOpenScheduled}
          disabled={counts.scheduled === 0}
          className={cn(
            'flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold transition-colors',
            counts.scheduled === 0
              ? 'cursor-default bg-muted text-muted-foreground opacity-60'
              : toLaunchCount > 0
                ? 'bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-950 dark:text-red-100 dark:hover:bg-red-900'
                : 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200 dark:bg-indigo-950 dark:text-indigo-100 dark:hover:bg-indigo-900'
          )}
        >
          <CalendarClock className="h-4 w-4" />
          {toLaunchCount > 0 ? `${toLaunchCount} à lancer` : 'Programmées'}
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-black/10 px-1 text-xs dark:bg-white/15">
            {counts.scheduled}
          </span>
        </button>

        {/* À produire : la charge de travail dérivée des commandes, par jour. */}
        <button
          type="button"
          onClick={onOpenProduction}
          disabled={counts.production === 0}
          className={cn(
            'flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold transition-colors',
            counts.production === 0
              ? 'cursor-default bg-muted text-muted-foreground opacity-60'
              : 'bg-secondary-100 text-secondary-800 hover:bg-secondary-200 dark:bg-secondary-950 dark:text-secondary-100 dark:hover:bg-secondary-900'
          )}
        >
          <ClipboardList className="h-4 w-4" />À produire
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-black/10 px-1 text-xs dark:bg-white/15">
            {counts.production}
          </span>
        </button>

        {/* Prêtes : commandes en attente de récupération, rangées dans un bottom sheet. */}
        <button
          type="button"
          onClick={onOpenReady}
          disabled={counts.ready === 0}
          className={cn(
            'flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold transition-colors',
            counts.ready === 0
              ? 'cursor-default bg-muted text-muted-foreground opacity-60'
              : readyAlert
                ? 'bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-950 dark:text-red-100 dark:hover:bg-red-900'
                : 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-950 dark:text-green-100 dark:hover:bg-green-900'
          )}
        >
          <PackageCheck className="h-4 w-4" />
          Prêtes
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-black/10 px-1 text-xs dark:bg-white/15">
            {counts.ready}
          </span>
        </button>
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
