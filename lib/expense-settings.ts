// lib/expense-settings.ts
//
// Schéma Zod + défauts des réglages du module dépenses (seuils de fréquence,
// de cumul, de détection de prix aberrant, durée de vie d'un brouillon,
// seuil de suggestion de récurrence). Mappage d'une ligne DB → config
// effective. Persistance dans lib/expense-settings-db.ts (singleton, calque
// de l'inventaire).

import { z } from 'zod';
import { EXPENSE_AMOUNT_MAX } from '@/config/constants';

export const expenseSettingsSchema = z.object({
  freqWindowDays: z.number().int().min(1).max(365),
  freqMinCount: z.number().int().min(1),
  cumulativeMinAmount: z.number().int().min(0).max(EXPENSE_AMOUNT_MAX),
  priceAberrantFactor: z.number().int().min(1),
  draftTtlMinutes: z.number().int().min(1).max(120),
  recurrenceSuggestMinHits: z.number().int().min(1),
});

export type ExpenseSettings = z.infer<typeof expenseSettingsSchema>;

export const DEFAULT_EXPENSE_SETTINGS: ExpenseSettings = {
  freqWindowDays: 30,
  freqMinCount: 3,
  cumulativeMinAmount: 20000,
  priceAberrantFactor: 3,
  draftTtlMinutes: 10,
  recurrenceSuggestMinHits: 3,
};

/** Ligne DB partielle → config effective (défauts si champ manquant/null). */
export function expenseSettingsFromRow(
  row: Partial<ExpenseSettings> | null | undefined
): ExpenseSettings {
  return { ...DEFAULT_EXPENSE_SETTINGS, ...(row ?? {}) };
}
