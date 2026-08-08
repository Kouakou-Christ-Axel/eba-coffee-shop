'use client';

// components/layouts/navbar-orders-button.tsx
//
// Raccourci « Mes commandes » dans la navbar, affiché UNIQUEMENT si cet
// appareil a déjà commandé (historique localStorage non vide). Pour un
// habitué c'est le chemin de recommande le plus court ; pour un nouveau
// visiteur l'icône n'existe pas et n'encombre pas la barre.

import { Button, Link, NavbarItem, Tooltip } from '@heroui/react';
import { Receipt } from 'lucide-react';
import { useHasOrderHistory } from '@/lib/hooks/use-order-history';

// Le composant rend son propre `NavbarItem` : sans historique il ne laisse
// AUCUN `<li>` derrière lui, donc pas de `gap` orphelin dans la barre.
export default function NavbarOrdersButton() {
  const hasOrders = useHasOrderHistory();

  if (!hasOrders) return null;

  return (
    <NavbarItem>
      <Tooltip content="Mes commandes" placement="bottom" closeDelay={0}>
        <Button
          as={Link}
          href="/mes-commandes"
          isIconOnly
          radius="full"
          variant="light"
          size="sm"
          aria-label="Mes commandes"
          // Secondaire face au panier et au CTA : l'icône se pose en retrait
          // plutôt qu'en noir plein, et s'affirme au survol.
          className="text-foreground/60 data-[hover=true]:text-foreground"
        >
          <Receipt className="h-[18px] w-[18px]" aria-hidden />
        </Button>
      </Tooltip>
    </NavbarItem>
  );
}
