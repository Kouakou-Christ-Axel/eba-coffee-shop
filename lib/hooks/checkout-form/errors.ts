import type { CheckoutErrorCode, SoldOutLine } from '@/lib/schemas/order';
import { extractApiError } from '@/lib/api-error';
import type { CheckoutFormErrors, CheckoutSubmitOutcome } from './types';

/** Message quand le serveur a échoué (5xx) : on rassure sur l'état — rien n'a été enregistré, réessayer ne créera pas de doublon. */
export const SERVER_ERROR_MESSAGE =
  'Petit souci de notre côté : ta commande n’a pas été enregistrée. Réessaie dans un instant.';

export const VALIDATION_FORM_FIELDS = [
  'customerName',
  'customerPhone',
  'pickupTime',
  'note',
  'paymentMethod',
] as const satisfies readonly (keyof CheckoutFormErrors)[];

export function validationFieldError(
  error: unknown
): { field: keyof CheckoutFormErrors; message: string } | null {
  if (!error || typeof error !== 'object') return null;
  const fieldErrors = (error as { fieldErrors?: Record<string, string[]> })
    .fieldErrors;
  if (!fieldErrors) return null;
  for (const field of VALIDATION_FORM_FIELDS) {
    const message = fieldErrors[field]?.[0];
    if (message) return { field, message };
  }
  return null;
}

/** Traduit une réponse d'erreur de POST /api/commandes en issue affichable. */
export function mapCheckoutError(
  status: number,
  data: { code?: CheckoutErrorCode; error?: unknown; items?: SoldOutLine[] }
): Extract<CheckoutSubmitOutcome, { ok: false }> {
  const message = extractApiError(data.error);
  switch (data.code) {
    case 'SOLD_OUT_TODAY':
      return {
        ok: false,
        code: data.code,
        error: message ?? 'Un article de votre panier est épuisé aujourd’hui.',
        soldOutLines: data.items ?? [],
      };
    case 'ADVANCE_ORDER_REQUIRED':
    case 'SCHEDULE_UNAVAILABLE':
      return {
        ok: false,
        code: data.code,
        field: 'pickupTime',
        error: message ?? 'Choisissez une autre date de retrait.',
      };
    // Récompense consommée entre-temps (ex. au comptoir).
    case 'LOYALTY_REWARD_UNAVAILABLE':
      return {
        ok: false,
        code: data.code,
        error:
          'Récompense fidélité indisponible — réessaie sans la récompense.',
      };
    // Le menu a changé depuis que le panier a été rempli (prix, produit retiré) :
    // rien n'a été créé ni facturé. Recharger la carte remet les prix à jour.
    case 'CART_CHANGED':
      return {
        ok: false,
        code: data.code,
        error:
          'Le menu a changé depuis que tu as rempli ton panier. Recharge la carte pour voir les prix à jour, rien n’a été facturé.',
      };
    case 'VALIDATION': {
      const fieldError = validationFieldError(data.error);
      if (fieldError) {
        return {
          ok: false,
          code: data.code,
          field: fieldError.field,
          error: fieldError.message,
        };
      }
      return {
        ok: false,
        code: data.code,
        error: message
          ? `Certaines informations sont invalides (${message}).`
          : 'Certaines informations sont invalides.',
      };
    }
  }
  if (status >= 500) {
    return { ok: false, code: data.code, error: SERVER_ERROR_MESSAGE };
  }
  return { ok: false, error: 'Une erreur est survenue. Veuillez réessayer.' };
}
