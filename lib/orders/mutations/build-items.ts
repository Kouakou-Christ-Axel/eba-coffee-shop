// Mutations de commandes — build-items.

import { getMenuAdmin } from '@/lib/menu';
import { cartItemSchema, type CartItemInput } from '@/lib/schemas/order';

export type OrderItemRef = {
  productId: string;
  quantity: number;
  /** Suppléments choisis, par nom de groupe + nom d'option (prix résolu ici). */
  supplements?: { groupName: string; optionName: string; quantity?: number }[];
  /** Remise (montant fixe FCFA) appliquée à la ligne. */
  discount?: number;
  discountReason?: string | null;
};

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
