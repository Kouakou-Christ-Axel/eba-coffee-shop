import { z } from 'zod';
import { normalizeIvorianPhone } from '@/lib/phone';
import {
  ORDER_CUSTOMER_NAME_MAX,
  ORDER_CUSTOMER_NAME_MAX_WORDS,
} from '@/config/constants';

export const onlineCustomerNameSchema = z
  .string()
  .trim()
  .max(ORDER_CUSTOMER_NAME_MAX)
  .refine((val) => val.split(/\s+/).filter(Boolean).length >= 2, {
    message: 'Indique ton nom et prénom',
  })
  .refine(
    (val) =>
      val.split(/\s+/).filter(Boolean).length <= ORDER_CUSTOMER_NAME_MAX_WORDS,
    { message: 'Nom trop long' }
  );

export const onlineCustomerPhoneSchema = z
  .string()
  .trim()
  .min(8)
  .max(20)
  .refine((val) => normalizeIvorianPhone(val) !== null, {
    message: 'Numéro de téléphone invalide',
  });

/** Sous-ensemble validé en live par `ContactFields` (react-hook-form). */
export const contactFieldsSchema = z.object({
  customerName: onlineCustomerNameSchema,
  customerPhone: onlineCustomerPhoneSchema,
});

export type ContactFieldsInput = z.infer<typeof contactFieldsSchema>;
