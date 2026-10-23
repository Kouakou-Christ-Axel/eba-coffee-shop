// lib/credit-settings.ts
//
// Schéma Zod + défauts des règles d'usage de l'avoir. Éditables dans la page
// Paramètres (ADMIN). Même patron que `lib/loyalty-settings.ts`.

import { z } from 'zod';
import { EXPENSE_AMOUNT_MAX } from '@/config/constants';

export const creditSettingsSchema = z.object({
  enabled: z.boolean(),
  /** Reste minimum à payer (FCFA) : l'avoir ne fait jamais passer la commande en dessous. */
  minRemaining: z.number().int().min(0).max(EXPENSE_AMOUNT_MAX),
  /** Part maximale de la commande qu'un avoir peut couvrir (1–100 %). */
  maxPercent: z.number().int().min(1).max(100),
  /**
   * Avoir utilisable sur la commande en ligne. Faux par défaut : sans SMS/OTP, le
   * numéro seul ne prouve rien (n'importe qui pourrait dépenser l'avoir d'autrui).
   */
  onlineEnabled: z.boolean(),
  /** Avoir max. dépensable en ligne par client et par jour (FCFA), si activé. */
  onlineDailyCap: z.number().int().min(0).max(EXPENSE_AMOUNT_MAX),
});

export type CreditSettings = z.infer<typeof creditSettingsSchema>;

export const DEFAULT_CREDIT_SETTINGS: CreditSettings = {
  enabled: true,
  minRemaining: 1500,
  maxPercent: 70,
  onlineEnabled: false,
  onlineDailyCap: 5000,
};

/** Ligne DB partielle → config effective (défauts si champ manquant/null). */
export function creditSettingsFromRow(
  row: Partial<CreditSettings> | null | undefined
): CreditSettings {
  return { ...DEFAULT_CREDIT_SETTINGS, ...(row ?? {}) };
}
