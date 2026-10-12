import { Bike, Bot, Coffee, Globe, ShoppingBag } from 'lucide-react';
import type { PreparationOrder } from '@/lib/preparation-queue';
import type { OrderType } from '@/generated/prisma/client';

export const ORDER_TYPE_META: Record<
  OrderType,
  { label: string; Icon: typeof Bike }
> = {
  DELIVERY: { label: 'Livraison', Icon: Bike },
  DINE_IN: { label: 'Sur place', Icon: Coffee },
  TAKEAWAY: { label: 'À emporter', Icon: ShoppingBag },
};

// Origine de création : même patron que la caisse
// (`app/(dashboard)/dashboard/caisse/order-card.tsx`) — le cas courant
// CASHIER n'affiche rien, ONLINE/MCP se distinguent d'un coup d'œil.
export const SOURCE_META: Partial<
  Record<PreparationOrder['source'], { label: string; Icon: typeof Globe }>
> = {
  ONLINE: { label: 'En ligne', Icon: Globe },
  MCP: { label: 'MCP', Icon: Bot },
};
