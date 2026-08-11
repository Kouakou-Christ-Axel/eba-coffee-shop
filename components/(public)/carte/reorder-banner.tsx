'use client';

// components/(public)/carte/reorder-banner.tsx
//
// « Reprendre ma dernière commande » : une vitrine personnelle, placée avant la
// vitrine générique. Le client fidèle qui reprend toujours la même chose n'a
// plus à reconstituer sa commande produit par produit.
//
// Les articles ne sont PAS dans le localStorage (`lib/order-history.ts` ne
// garde que id/référence/total/date) : il faut les relire depuis
// `GET /api/commandes/:id`. Cet appel est `force-dynamic`, donc il est déclenché
// AU CLIC seulement — le faire au montage taxerait chaque visite d'un client
// récurrent pour une action qu'il ne fera peut-être pas.

import { useState } from 'react';
import { Button } from '@heroui/react';
import { RotateCcw } from 'lucide-react';
import type { MenuCategory } from '@/config/menu';
import type { CartItem } from '@/lib/cart-store';
import { useCartStore } from '@/lib/cart-store';
import { useLastOrder } from '@/lib/hooks/use-order-history';
import { buildReorderPlan, formatReorderOutcomeLabel } from '@/lib/reorder';

type Props = {
  /** Menu COURANT : c'est lui qui re-tarife et revalide chaque ligne. */
  menuData: MenuCategory[];
};

function ReorderBanner({ menuData }: Props) {
  const lastOrder = useLastOrder();
  const addItem = useCartStore((s) => s.addItem);
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // `useLastOrder` renvoie `null` au SSR et au premier rendu client (snapshot
  // serveur distinct) : pas de mismatch d'hydratation, même pattern que la
  // pastille panier de la navbar.
  if (!lastOrder) return null;

  async function handleReorder() {
    if (!lastOrder) return;
    setPending(true);
    setError(null);

    try {
      const res = await fetch(`/api/commandes/${lastOrder.id}`);
      if (!res.ok) throw new Error(String(res.status));
      const order: { items?: CartItem[] } = await res.json();

      const plan = buildReorderPlan(order.items ?? [], menuData);
      plan.addable.forEach((line) => {
        // `addItem` ajoute une unité à la fois et plafonne lui-même sur le
        // stock : appelable en boucle sans dupliquer son garde-fou.
        for (let i = 0; i < line.quantity; i++) {
          addItem(line.item, line.maxQuantity ?? undefined);
        }
      });
      setOutcome(formatReorderOutcomeLabel(plan));
    } catch {
      setError('Impossible de récupérer votre commande. Réessayez.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="content-container mt-6">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-secondary/20 bg-secondary/5 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            Reprendre votre dernière commande
          </p>
          <p
            role="status"
            aria-live="polite"
            className="mt-0.5 truncate text-xs text-foreground/60"
          >
            {error ?? outcome ?? lastOrder.reference}
          </p>
        </div>

        {outcome === null && (
          <Button
            radius="full"
            color="secondary"
            size="sm"
            isLoading={pending}
            onPress={handleReorder}
            startContent={
              pending ? null : (
                <RotateCcw aria-hidden="true" className="h-4 w-4" />
              )
            }
            className="shrink-0 cursor-pointer font-medium"
          >
            {pending ? 'Ajout…' : 'Tout remettre au panier'}
          </Button>
        )}
      </div>
    </div>
  );
}

export default ReorderBanner;
