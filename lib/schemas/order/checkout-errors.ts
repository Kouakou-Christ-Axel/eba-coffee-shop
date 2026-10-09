import { z } from 'zod';

export const checkoutErrorCodeSchema = z.enum([
  'INVALID_BODY',
  'VALIDATION',
  'SOLD_OUT_TODAY',
  'ADVANCE_ORDER_REQUIRED',
  'SCHEDULE_UNAVAILABLE',
  'LOYALTY_REWARD_UNAVAILABLE',
  'CART_CHANGED',
  'PAYMENT_PROVIDER_ERROR',
  // Routes publiques de la page de suivi (app/api/commandes/[id]/*).
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'SERVER_ERROR',
]);

export type CheckoutErrorCode = z.infer<typeof checkoutErrorCodeSchema>;

export const soldOutLineSchema = z.object({
  cartId: z.string(),
  productId: z.string(),
  productName: z.string(),
  /** Le produit lui-même manque (sinon, seuls des goûts sont en cause). */
  missingProduct: z.boolean(),
  /** Goûts/options épuisés sur cette ligne. */
  missingOptionNames: z.array(z.string()),
  /** Stock restant du produit (`null` = illimité, absent = produit supprimé). */
  remaining: z.number().int().nullable().optional(),
});

export type SoldOutLine = z.infer<typeof soldOutLineSchema>;
