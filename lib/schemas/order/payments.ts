import { z } from 'zod';
import { paymentModeSchema } from './enums';

export const orderPaymentLineSchema = z.object({
  mode: paymentModeSchema,
  amount: z.number().int().positive('Montant invalide'),
});

export const orderPaymentsSchema = z
  .array(orderPaymentLineSchema)
  .min(1, 'Au moins un moyen de paiement');

export type OrderPaymentLineInput = z.infer<typeof orderPaymentLineSchema>;
