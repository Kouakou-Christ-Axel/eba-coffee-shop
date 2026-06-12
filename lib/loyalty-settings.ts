// lib/loyalty-settings.ts
//
// Schéma Zod + défauts des réglages de fidélité (carte à tampons). Éditables
// dans la page Paramètres (ADMIN). Mappage d'une ligne DB → config effective.

import { z } from 'zod';
import { EXPENSE_AMOUNT_MAX } from '@/config/constants';

const amount = z.number().int().min(0).max(EXPENSE_AMOUNT_MAX);

export const loyaltySettingsSchema = z
  .object({
    enabled: z.boolean(),
    minOrderAmount: amount,
    stampsPerCard: z.number().int().min(2).max(50),
    tier1Stamps: z.number().int().min(1).max(49),
    tier1RewardCap: amount,
    tier2RewardCap: amount,
    oneStampPerDay: z.boolean(),
  })
  .refine((v) => v.tier1Stamps < v.stampsPerCard, {
    message:
      'Le palier intermédiaire doit être inférieur à la taille de la carte',
    path: ['tier1Stamps'],
  });

export type LoyaltySettings = z.infer<typeof loyaltySettingsSchema>;

export const DEFAULT_LOYALTY_SETTINGS: LoyaltySettings = {
  enabled: true,
  minOrderAmount: 1000,
  stampsPerCard: 10,
  tier1Stamps: 5,
  tier1RewardCap: 1000,
  tier2RewardCap: 2500,
  oneStampPerDay: true,
};

/** Ligne DB partielle → config effective (défauts si champ manquant/null). */
export function loyaltySettingsFromRow(
  row: Partial<LoyaltySettings> | null | undefined
): LoyaltySettings {
  return { ...DEFAULT_LOYALTY_SETTINGS, ...(row ?? {}) };
}
