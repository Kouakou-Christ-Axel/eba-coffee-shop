'use client';

// components/(public)/commande/recent-orders-link.tsx
//
// Pill « Mes commandes » affichée sur /carte UNIQUEMENT quand l'appareil a
// déjà commandé (historique localStorage non vide). Rendu null au SSR et
// pendant l'hydratation (snapshot serveur `false`) — pas de mismatch.

import Link from 'next/link';
import { Receipt } from 'lucide-react';
import { useHasOrderHistory } from '@/lib/hooks/use-order-history';
import { cn } from '@/lib/utils';

type Props = {
  /**
   * Habillage de la pill. Par défaut elle est calée sur un fond clair ; le hero
   * de l'accueil (photo + voile noir) passe sa propre variante claire, sinon
   * elle y serait illisible.
   */
  className?: string;
};

export function RecentOrdersLink({ className }: Props = {}) {
  const hasOrders = useHasOrderHistory();

  if (!hasOrders) return null;

  return (
    <div className="flex justify-center">
      <Link
        href="/mes-commandes"
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border border-foreground/15 bg-background px-4 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:border-primary/40 hover:text-primary',
          className
        )}
      >
        <Receipt className="h-3.5 w-3.5" />
        Mes commandes
      </Link>
    </div>
  );
}
