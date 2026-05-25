// Normalisation des numéros de téléphone Côte d'Ivoire.
// Indicatif +225, format E.164 attendu en sortie.

const CI_COUNTRY_CODE = '225';

/**
 * Normalise un numéro CI saisi par l'utilisateur en format E.164.
 *
 * Accepte les variations courantes :
 *   - "07 88 12 34 56" → "+22507881234567"  (numéro local sans préfixe)
 *   - "+225 07 88 12 34 56" → "+22507881234567"
 *   - "00225 07 88 12 34 56" → "+22507881234567"
 *   - "22507881234567" → "+22507881234567"
 *
 * Retourne null si le format est invalide (trop court / trop long après
 * nettoyage).
 */
export function normalizeIvorianPhone(input: string): string | null {
  let digits = input.replace(/\D/g, '');

  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  if (!digits.startsWith(CI_COUNTRY_CODE)) {
    digits = CI_COUNTRY_CODE + digits;
  }

  // Numéros CI : 225 + 10 chiffres locaux = 13 chiffres
  if (digits.length < 12 || digits.length > 14) {
    return null;
  }

  return `+${digits}`;
}

/**
 * Format pour les liens wa.me : indicatif + numéro local SANS le `+`.
 * Ex. "+22507881234567" → "22507881234567"
 */
export function toWhatsAppNumber(e164: string): string {
  return e164.replace(/^\+/, '');
}

/** Format d'affichage lisible. Ex. "+22507881234567" → "+225 07 88 12 34 56" */
export function formatPhoneForDisplay(e164: string): string {
  const normalized = normalizeIvorianPhone(e164);
  if (!normalized) return e164;

  const local = normalized.slice(4); // sans +225
  // Découpe par paires : 07 88 12 34 56
  const groups = local.match(/.{1,2}/g)?.join(' ') ?? local;
  return `+${CI_COUNTRY_CODE} ${groups}`;
}
