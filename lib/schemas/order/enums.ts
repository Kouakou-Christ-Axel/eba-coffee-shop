import { z } from 'zod';
import { PAYMENT_MODES } from '@/lib/payment-modes';

export const orderStatusSchema = z.enum([
  'NEW',
  'PREPARING',
  'READY',
  'COMPLETED',
  'CANCELLED',
]);

export const orderTypeSchema = z.enum(['DELIVERY', 'DINE_IN', 'TAKEAWAY']);

export const paymentModeSchema = z.enum(PAYMENT_MODES);

export type OrderStatusInput = z.infer<typeof orderStatusSchema>;

export type OrderTypeInput = z.infer<typeof orderTypeSchema>;

export type PaymentModeInput = z.infer<typeof paymentModeSchema>;
