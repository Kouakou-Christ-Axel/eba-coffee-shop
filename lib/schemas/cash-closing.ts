// lib/schemas/cash-closing.ts
//
// Schéma Zod centralisé pour la clôture de caisse (journalière, espèces).
// Réutilisé par les server actions du dashboard et le serveur MCP.

import { z } from 'zod';
import { EXPENSE_NOTE_MAX, EXPENSE_AMOUNT_MAX } from '@/config/constants';

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format YYYY-MM-DD');

const amount = z
  .number()
  .int('Montant entier (FCFA)')
  .min(0, 'Montant invalide')
  .max(EXPENSE_AMOUNT_MAX, 'Montant trop élevé');

export const cashClosingInputSchema = z.object({
  date: dateOnly,
  openingFloat: amount, // fond de caisse
  countedCash: amount, // espèces comptées
  note: z
    .string()
    .trim()
    .max(EXPENSE_NOTE_MAX, 'Note trop longue')
    .nullable()
    .optional(),
});

export type CashClosingInput = z.infer<typeof cashClosingInputSchema>;
