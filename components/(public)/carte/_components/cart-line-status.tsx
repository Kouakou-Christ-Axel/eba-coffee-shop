'use client';

// components/(public)/carte/_components/cart-line-status.tsx
//
// Chip d'état d'une ligne du panier (épuisé, goût épuisé, plus que N, plus
// disponible…), partagé par le tiroir et le récapitulatif de la page de
// commande. Rien n'est affiché pour une ligne sans problème.

import { Chip } from '@heroui/react';
import {
  cartLineStatusLabel,
  type CartLineStatus,
} from '@/lib/cart-availability';

export function CartLineStatusChip({
  status,
}: {
  status: CartLineStatus | undefined;
}) {
  const label = cartLineStatusLabel(status);
  if (!label) return null;
  return (
    <Chip size="sm" variant="flat" color={label.color} className="mt-1">
      {label.label}
    </Chip>
  );
}
