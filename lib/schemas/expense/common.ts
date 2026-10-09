import { z } from 'zod';

export const expensePaymentMethodSchema = z.enum([
  'CASH',
  'WAVE',
  'BANK',
  'OTHER',
]);

export type ExpensePaymentMethodInput = z.infer<
  typeof expensePaymentMethodSchema
>;

export const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format YYYY-MM-DD');
