// lib/orders/mutations/build-items.ts
//
// Mutations de commandes — build-items (extrait de lib/order-mutations.ts, sans changement de comportement).

import { getMenuAdmin } from '@/lib/menu';
import { cartItemSchema, type CartItemInput } from '@/lib/schemas/order';

// ─── Construction d'articles depuis le menu (références produit → lignes) ──────
//
// Pour l'outil MCP : un client comme Claude ne fournit que `productId` + quantité
// (+ suppléments par nom) ; on résout prix de base, coûts et prix des suppléments
// depuis le menu (source de vérité), évitant au client de connaître les montants.

export type OrderItemRef = {
  productId: string;
  quantity: number;
  /**
   * Suppléments choisis, par nom de groupe + nom d'option (prix résolu ici).
   * `quantity` (défaut 1) sert aux groupes type 'quantity' (répartition,
   * ex. 2x un goût).
   */
  supplements?: { groupName: string; optionName: string; quantity?: number }[];
  /** Remise (montant fixe FCFA) appliquée à la ligne. */
  discount?: number;
  discountReason?: string | null;
};

/**
 * Transforme des références produit en lignes de panier complètes en résolvant
 * les montants depuis le menu. Lève une erreur si un produit ou un supplément
 * est introuvable. Le résultat est validé par `cartItemSchema` (plafond de
 * remise, entiers, etc.).
 */
export async function buildOrderItemsFromMenu(
  refs: OrderItemRef[]
): Promise<CartItemInput[]> {
  const menu = await getMenuAdmin();
  const products = new Map(
    menu.flatMap((c) => c.products).map((p) => [p.id, p])
  );

  const items = refs.map((ref, idx) => {
    const product = products.get(ref.productId);
    if (!product) {
      throw new Error(`Produit introuvable : ${ref.productId}`);
    }

    const supplements = (ref.supplements ?? []).map((s) => {
      const group = product.supplements.find((g) => g.name === s.groupName);
      // Deux options peuvent partager un nom dans un même groupe (renommage,
      // ancien « goût » désactivé conservé) : on préfère toujours l'option
      // disponible, cohérent avec le décrément à l'entrée en cuisine
      // (`resolveOptionId`, § ci-dessus).
      const option =
        group?.options.find((o) => o.name === s.optionName && o.available) ??
        group?.options.find((o) => o.name === s.optionName);
      if (!group || !option) {
        throw new Error(
          `Supplément introuvable pour « ${product.name} » : ` +
            `${s.groupName} / ${s.optionName}`
        );
      }
      return {
        groupName: group.name,
        optionName: option.name,
        price: option.price,
        quantity: s.quantity ?? 1,
      };
    });

    return cartItemSchema.parse({
      cartId: `mcp-${idx}`,
      productId: product.id,
      productName: product.name,
      basePrice: product.price,
      coutMatiere: product.coutMatiere,
      coutEmballage: product.coutEmballage,
      quantity: ref.quantity,
      supplements,
      discount: ref.discount ?? 0,
      discountReason: ref.discountReason ?? null,
      requiresDeposit: product.requiresDeposit,
    });
  });

  return items;
}
