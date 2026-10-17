// lib/schemas/contact.ts
//
// Schéma du formulaire de contact public, partagé par le hook client
// (lib/hooks/use-contact-form.ts) et la route POST /api/contact.

import { z } from 'zod';

export const contactFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Nom requis (min 2 caractères)')
    .max(80, 'Nom trop long (max 80 caractères)'),
  email: z.string().trim().email('Email invalide').max(120, 'Email trop long'),
  phone: z
    .string()
    .trim()
    .max(30, 'Téléphone trop long')
    .optional()
    .or(z.literal('')),
  subject: z.enum(['question', 'reservation', 'partenariat'], {
    message: 'Choisissez un motif',
  }),
  message: z
    .string()
    .trim()
    .min(10, 'Message trop court (min 10 caractères)')
    .max(2000, 'Message trop long (max 2000 caractères)'),
});
