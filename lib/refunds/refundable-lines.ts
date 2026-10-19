// lib/refunds/refundable-lines.ts
//
// Lignes d'une commande que l'on peut rattacher à un remboursement (produits ET
// suppléments) et répartition d'un montant entre elles. Pur : partagé par le
// formulaire (client) et testable sans base.
//
// Valeur d'une ligne = prix catalogue figé sur la commande (`basePrice`, prix des
// suppléments) × quantités, avant remise : c'est une PROPOSITION de montant, le
// staff garde la main sur le montant final (remise fidélité globale, geste commercial…).

import type { CartItem } from '@/lib/cart-store';
import type { RefundLineInput } from '@/lib/schemas/refund';

export type RefundableLine = {
  /** Clé stable d'une ligne dans le formulaire. */
  key: string;
  cartId: string;
  productId: string;
  name: string;
  kind: 'PRODUCT' | 'SUPPLEMENT';
  groupName?: string;
  optionName?: string;
  /** Quantité maximale remboursable. */
  maxQuantity: number;
  /** Valeur d'une unité, en FCFA. */
  unitAmount: number;
};

export function buildRefundableLines(items: CartItem[]): RefundableLine[] {
  const lines: RefundableLine[] = [];
  for (const item of items) {
    lines.push({
      key: `P|${item.cartId}`,
      cartId: item.cartId,
      productId: item.productId,
      name: item.productName,
      kind: 'PRODUCT',
      maxQuantity: item.quantity,
      unitAmount: item.basePrice,
    });
    for (const s of item.supplements) {
      const perItem = s.quantity ?? 1;
      lines.push({
        key: `S|${item.cartId}|${s.groupName}|${s.optionName}`,
        cartId: item.cartId,
        productId: item.productId,
        name: `${item.productName} — ${s.optionName}`,
        kind: 'SUPPLEMENT',
        groupName: s.groupName,
        optionName: s.optionName,
        maxQuantity: perItem * item.quantity,
        unitAmount: s.price,
      });
    }
  }
  return lines;
}

export type LineSelection = Record<string, number>;

/** Somme des lignes cochées (quantité × valeur unitaire). */
export function selectionTotal(
  lines: RefundableLine[],
  selection: LineSelection
): number {
  return lines.reduce(
    (sum, l) => sum + (selection[l.key] ?? 0) * l.unitAmount,
    0
  );
}

/**
 * Lignes à envoyer au serveur. Si le montant du remboursement est inférieur à la
 * somme des lignes, chaque ligne est réduite au prorata (le serveur refuse des
 * lignes plus chères que le remboursement) ; l'arrondi retombe sur la dernière.
 */
export function selectionToLines(
  lines: RefundableLine[],
  selection: LineSelection,
  amount: number
): RefundLineInput[] {
  const chosen = lines.filter((l) => (selection[l.key] ?? 0) > 0);
  const gross = chosen.reduce((s, l) => s + selection[l.key] * l.unitAmount, 0);
  const ratio = gross > amount && gross > 0 ? amount / gross : 1;
  let allocated = 0;
  return chosen.map((l, i) => {
    const quantity = Math.min(selection[l.key], l.maxQuantity);
    const raw = quantity * l.unitAmount;
    const isLast = i === chosen.length - 1;
    const value =
      ratio === 1
        ? raw
        : isLast
          ? Math.max(0, amount - allocated)
          : Math.floor(raw * ratio);
    allocated += value;
    return {
      cartId: l.cartId,
      productId: l.productId,
      name: l.name,
      kind: l.kind,
      ...(l.groupName ? { groupName: l.groupName } : {}),
      ...(l.optionName ? { optionName: l.optionName } : {}),
      quantity,
      amount: value,
    };
  });
}
