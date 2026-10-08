'use client';

import { Clock, X } from 'lucide-react';
import { priceFormatter } from '@/config/menu';
import { summarizeParked, type ParkedOrder } from '@/lib/parked-orders-store';

type Props = {
  parked: ParkedOrder[];
  onResume: (id: string) => void;
  onDiscard: (id: string) => void;
};

const timeFormatter = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Africa/Abidjan',
});

/**
 * Commandes mises de côté : un tap reprend la commande là où elle avait été
 * laissée (la commande en cours, s'il y en a une, est rangée à sa place).
 * Rien n'est rendu quand il n'y en a pas.
 */
export function ParkedOrdersBar({ parked, onResume, onDiscard }: Props) {
  if (parked.length === 0) return null;

  return (
    <section aria-label="Commandes en attente" className="min-w-0">
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">
        En attente ({parked.length})
      </p>
      <ul className="flex gap-2 overflow-x-auto pb-1">
        {parked.map((p) => {
          const { itemCount, total } = summarizeParked(p);
          const label = p.customerName.trim() || 'Sans nom';
          return (
            <li
              key={p.id}
              className="flex shrink-0 items-center rounded-lg border bg-card"
            >
              <button
                type="button"
                onClick={() => onResume(p.id)}
                className="flex min-h-11 flex-col items-start px-3 py-1 text-left"
              >
                <span className="max-w-[10rem] truncate text-sm font-medium">
                  {label}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" aria-hidden />
                  {timeFormatter.format(p.parkedAt)} · {itemCount} article
                  {itemCount > 1 ? 's' : ''} · {priceFormatter.format(total)}
                </span>
              </button>
              <button
                type="button"
                aria-label={`Supprimer la commande en attente de ${label}`}
                onClick={() => {
                  if (window.confirm(`Supprimer la commande de ${label} ?`))
                    onDiscard(p.id);
                }}
                className="flex h-11 w-11 items-center justify-center text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
