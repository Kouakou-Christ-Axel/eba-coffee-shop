import { z } from 'zod';
import {
  MAX_LINE_DISCOUNT_RATIO,
  ORDER_DISCOUNT_REASON_MAX,
} from '@/config/constants';

export const cartItemSupplementSchema = z.object({
  groupName: z.string(),
  optionName: z.string(),
  price: z.number().int().nonnegative(),
  // Nombre de fois où cette option est choisie (groupe type 'quantity', ex.
  // 2x « Vanille »). Absent/1 pour les choix 'single'/'multiple' classiques.
  quantity: z.number().int().positive().optional().default(1),
});

export const cartItemSchema = z
  .object({
    cartId: z.string(),
    productId: z.string(),
    productName: z.string(),
    basePrice: z.number().int().nonnegative(),
    coutMatiere: z.number().int().nonnegative().default(0),
    coutEmballage: z.number().int().nonnegative().default(0),
    quantity: z.number().int().positive(),
    supplements: z.array(cartItemSupplementSchema),
    // Marque une ligne ajoutée après la création de la commande.
    addedLater: z.boolean().optional().default(false),
    // Remise (montant fixe FCFA) appliquée à la ligne, motif optionnel.
    discount: z.number().int().nonnegative().optional().default(0),
    discountReason: z
      .string()
      .trim()
      .max(ORDER_DISCOUNT_REASON_MAX, 'Motif trop long')
      .nullable()
      .optional(),
    // Snapshot de `Product.requiresDeposit` au moment de l'ajout au panier
    // (voir lib/deposits.ts). Absent/false = pas d'acompte exigé.
    requiresDeposit: z.boolean().optional().default(false),
  })
  // La remise d'une ligne ne peut pas dépasser le plafond métier.
  .refine(
    (it) => {
      const supplementsTotal = it.supplements.reduce(
        (s, x) => s + x.price * x.quantity,
        0
      );
      const gross = (it.basePrice + supplementsTotal) * it.quantity;
      return (it.discount ?? 0) <= Math.floor(gross * MAX_LINE_DISCOUNT_RATIO);
    },
    {
      message: `Remise trop élevée (max ${Math.round(MAX_LINE_DISCOUNT_RATIO * 100)}% de la ligne)`,
      path: ['discount'],
    }
  );

export type CartItemSupplementInput = z.infer<typeof cartItemSupplementSchema>;

export type CartItemInput = z.infer<typeof cartItemSchema>;
