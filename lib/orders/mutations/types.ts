// lib/orders/mutations/types.ts
//
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
  /** Jour civil d'antidatage (YYYY-MM-DD). Absent = jour en cours. */
  orderDate?: string | null;
  /** Utilisateur caisse à l'origine ; null pour un outil MCP. */
  createdById?: string | null;
  /**
   * Origine de création (cf. enum `OrderSource`, prisma/schema.prisma).
   * Défaut `CASHIER` (l'appelant caisse le plus courant) ; l'outil MCP
   * `create_order` (lib/mcp/tools.ts) passe explicitement `MCP`.
   */
  source?: OrderSource;
  /** Récompense fidélité (carte à tampons) à appliquer à cette commande. */
  loyaltyRewardId?: string | null;
  /**
   * Force l'« ardoise » (envoi direct en cuisine sans encaissement) même si le
   * client n'est pas marqué de confiance — dérogation du caissier pour un
   * walk-in qu'il connaît, ou pour désactiver le départ automatique en
   * cuisine d'un sur-place/à-emporter (`false`). Absent = on suit
   * `Customer.isTrusted` OU le type de commande (cf. `autoOnAccount`
   * ci-dessous).
   */
  onAccount?: boolean;
  /**
   * Le staff a confirmé avoir produit la quantité manquante après une 409 de
   * pénurie — mêmes sémantiques que `sendOrderToKitchen`/`setOrderPayment`.
   */
  coverShortage?: boolean;
};
