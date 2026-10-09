// Types partagés des mutations de commandes.

import type { OrderSource } from '@/generated/prisma/client';
import type { CartItemInput, OrderTypeInput } from '@/lib/schemas/order';

export type CreateCashierOrderInput = {
  items: CartItemInput[];
  customerName?: string | null;
  customerPhone?: string | null;
  orderType: OrderTypeInput;
  note?: string | null;
  pickupTime?: string | null;
  /** Jour civil d'antidatage (YYYY-MM-DD). */
  orderDate?: string | null;
  /** Utilisateur caisse à l'origine ; null pour un outil MCP. */
  createdById?: string | null;
  /** Origine de création de la commande. */
  source?: OrderSource;
  /** Récompense fidélité (carte à tampons) à appliquer à cette commande. */
  loyaltyRewardId?: string | null;
  onAccount?: boolean;
  coverShortage?: boolean;
};
