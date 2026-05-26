'use client';

import { Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ConnState } from './use-orders-stream';

/**
 * Pastille d'état de la connexion SSE — réutilisée par tous les écrans
 * dashboard qui consomment `useOrdersStream`.
 */
export function ConnectionBadge({ state }: { state: ConnState }) {
  const config = {
    connecting: {
      label: 'Connexion…',
      dotClass: 'bg-muted-foreground animate-pulse',
      Icon: Wifi,
    },
    connected: {
      label: 'En direct',
      dotClass: 'bg-green-500',
      Icon: Wifi,
    },
    reconnecting: {
      label: 'Reconnexion…',
      dotClass: 'bg-amber-500 animate-pulse',
      Icon: Wifi,
    },
    disconnected: {
      label: 'Hors ligne',
      dotClass: 'bg-red-500',
      Icon: WifiOff,
    },
  }[state];

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
      title={config.label}
    >
      <span className={cn('h-2 w-2 rounded-full', config.dotClass)} />
      <span className="hidden sm:inline">{config.label}</span>
    </span>
  );
}
