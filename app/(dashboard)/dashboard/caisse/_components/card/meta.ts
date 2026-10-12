import { Bike, Coffee, ShoppingBag, Globe, Bot } from 'lucide-react';
import { type CashierOrder } from '@/lib/cashier-queue';
import { type OrderType } from '@/generated/prisma/client';

export const ORDER_TYPE_META: Record<
  OrderType,
  { label: string; Icon: typeof Bike }
> = {
  DELIVERY: { label: 'Livraison', Icon: Bike },
  DINE_IN: { label: 'Sur place', Icon: Coffee },
  TAKEAWAY: { label: 'À emporter', Icon: ShoppingBag },
};

// Origine de création : CASHIER (cas courant) n'affiche rien ; ONLINE/MCP se repèrent d'un coup d'œil.
export const SOURCE_META: Partial<
  Record<CashierOrder['source'], { label: string; Icon: typeof Globe }>
> = {
  ONLINE: { label: 'En ligne', Icon: Globe },
  MCP: { label: 'MCP', Icon: Bot },
};
