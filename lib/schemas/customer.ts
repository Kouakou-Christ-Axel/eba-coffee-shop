// lib/schemas/customer.ts
//
// Schémas Zod centralisés pour le CRM (création / modification d'un client).
// Le client est identifié par son téléphone (clé canonique normalisée côté
// mutation via `customerPhoneKey`). Conformément à CLAUDE.md : pas de
// redéclaration inline ailleurs.

import { z } from 'zod';
import {
  ORDER_CUSTOMER_NAME_MAX,
  ORDER_CUSTOMER_PHONE_MAX,
} from '@/config/constants';

const nameField = z
  .string()
  .trim()
  .max(ORDER_CUSTOMER_NAME_MAX, 'Nom trop long')
  .nullable()
  .optional();

const phoneField = z
  .string()
  .trim()
  .min(1, 'Téléphone requis')
  .max(ORDER_CUSTOMER_PHONE_MAX, 'Téléphone trop long');

export const customerInputSchema = z.object({
  name: nameField,
  // Téléphone obligatoire à la création : c'est l'identité du client.
  phone: phoneField,
});

export type CustomerInput = z.infer<typeof customerInputSchema>;

// Mise à jour partielle : nom et/ou téléphone.
export const customerUpdateSchema = z
  .object({
    name: nameField,
    phone: phoneField.optional(),
  })
  .refine((v) => v.name !== undefined || v.phone !== undefined, {
    message: 'Au moins un champ à mettre à jour est requis',
  });

export type CustomerUpdateInput = z.infer<typeof customerUpdateSchema>;

// Fusion de deux comptes clients (doublon) : `sourceId` est absorbé par
// `targetId` (jamais l'inverse) — la source est supprimée après fusion.
export const customerMergeSchema = z
  .object({
    sourceId: z.string().min(1, 'Client source requis'),
    targetId: z.string().min(1, 'Client cible requis'),
  })
  .refine((v) => v.sourceId !== v.targetId, {
    message: 'Impossible de fusionner un client avec lui-même',
    path: ['targetId'],
  });

export type CustomerMergeInput = z.infer<typeof customerMergeSchema>;
