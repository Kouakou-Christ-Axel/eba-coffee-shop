import { z } from 'zod';
import {
  createOrderSchema as baseCreateOrderSchema,
  onlineCustomerNameSchema,
  onlineCustomerPhoneSchema,
  orderDriverFieldsSchema,
} from '@/lib/schemas/order';
import { JEKO_PAYMENT_METHODS } from '@/lib/jeko/payment-methods';

export const createOrderSchema = baseCreateOrderSchema
  .extend({
    customerName: onlineCustomerNameSchema,
    customerPhone: onlineCustomerPhoneSchema,
    pickupTime: z.string().datetime().nullable().optional(),
    orderType: z.enum(['TAKEAWAY', 'DELIVERY']).optional(),
    // Moyen choisi pour payer en ligne (Jèko). Exigé par la route dès que le
    // paiement en ligne est configuré ; ignoré sinon (flux historique).
    paymentMethod: z.enum(JEKO_PAYMENT_METHODS).optional(),
  })
  .extend(orderDriverFieldsSchema.partial().shape)
  .refine(
    (d) =>
      ((d.driverName ?? null) === null) === ((d.driverPhone ?? null) === null),
    {
      message: 'Nom et téléphone du livreur vont ensemble',
      path: ['driverPhone'],
    }
  );

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
