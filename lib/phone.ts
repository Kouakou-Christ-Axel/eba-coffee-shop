// Normalisation des numéros de téléphone Côte d'Ivoire.
// Indicatif +225, format E.164 attendu en sortie.

const CI_COUNTRY_CODE = '225';

/**
 * Basculement ARTCI du 31 janvier 2021 (PNN-10) : les anciens numéros locaux
 * à 8 chiffres ont reçu un préfixe à 2 chiffres selon l'opérateur d'origine.
 * Regroupés par nouveau préfixe (et non l'inverse) : pour ajouter/retirer un
 * ancien préfixe, il suffit d'éditer le tableau du bon opérateur ci-dessous.
 */
const LEGACY_PREFIX_GROUPS: Record<string, string[]> = {
  // Moov
  '01': [
    '01',
    '02',
    '03',
    '40',
    '41',
    '42',
    '43',
    '50',
    '51',
    '52',
    '53',
    '70',
    '71',
    '72',
    '73',
  ],
  // MTN
  '05': [
    '04',
    '05',
    '06',
    '44',
    '45',
    '46',
    '54',
    '55',
    '56',
    '64',
    '65',
    '66',
    '74',
    '75',
    '76',
    '84',
    '85',
    '86',
    '94',
    '95',
    '96',
  ],
  // Orange
  '07': [
    '07',
    '08',
    '09',
    '47',
    '48',
    '49',
    '57',
    '58',
    '59',
    '67',
    '68',
    '69',
    '77',
    '78',
    '79',
    '87',
    '88',
    '89',
    '97',
    '98',
  ],
};

const LEGACY_PREFIX_TO_NEW_PREFIX: ReadonlyMap<string, string> = new Map(
  Object.entries(LEGACY_PREFIX_GROUPS).flatMap(([newPrefix, oldPrefixes]) =>
    oldPrefixes.map((oldPrefix) => [oldPrefix, newPrefix] as const)
  )
);

/**
 * Met à niveau un numéro local CI pré-réforme (8 chiffres) vers le format
 * PNN-10 (10 chiffres), en préfixant le code opérateur déterminé à partir des
 * 2 premiers chiffres de l'ancien numéro (table `LEGACY_PREFIX_GROUPS`).
 *
 * Un numéro déjà à 10 chiffres est retourné tel quel (idempotent). Lève une
 * erreur si l'entrée n'a ni 8 ni 10 chiffres après nettoyage, ou si son
 * préfixe à 8 chiffres ne correspond à aucun opérateur connu.
 */
export function upgradeLegacyIvorianPhone(input: string): string {
  const digits = input.replace(/\D/g, '');

  if (digits.length === 10) {
    return digits;
  }

  if (digits.length !== 8) {
    throw new Error(
      `Numéro invalide : ${digits.length} chiffres (8 ou 10 attendus)`
    );
  }

  const oldPrefix = digits.slice(0, 2);
  const newPrefix = LEGACY_PREFIX_TO_NEW_PREFIX.get(oldPrefix);
  if (!newPrefix) {
    throw new Error(`Préfixe opérateur inconnu : ${oldPrefix}`);
  }

  return newPrefix + digits;
}

/**
 * Normalise un numéro CI saisi par l'utilisateur en format E.164.
 *
 * Accepte les variations courantes :
 *   - "07 88 12 34 56" → "+22507881234567"  (numéro local sans préfixe)
 *   - "+225 07 88 12 34 56" → "+22507881234567"
 *   - "00225 07 88 12 34 56" → "+22507881234567"
 *   - "22507881234567" → "+22507881234567"
 *   - "87 87 88 95" → "+2250787878895"  (ancien format 8 chiffres, mis à
 *     niveau automatiquement via `upgradeLegacyIvorianPhone`)
 *
 * Retourne null si le format est invalide (trop court / trop long après
 * nettoyage, ou ancien numéro à 8 chiffres dont le préfixe opérateur est
 * inconnu).
 */
export function normalizeIvorianPhone(input: string): string | null {
  let digits = input.replace(/\D/g, '');

  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  let local = digits.startsWith(CI_COUNTRY_CODE)
    ? digits.slice(CI_COUNTRY_CODE.length)
    : digits;

  if (local.length === 8) {
    try {
      local = upgradeLegacyIvorianPhone(local);
    } catch {
      // Préfixe opérateur inconnu : on laisse tel quel, la validation de
      // longueur ci-dessous rejette proprement (comportement inchangé).
    }
  }

  digits = CI_COUNTRY_CODE + local;

  // Numéros CI : 225 + 10 chiffres locaux = 13 chiffres
  if (digits.length < 12 || digits.length > 14) {
    return null;
  }

  return `+${digits}`;
}

/**
 * Clé canonique d'un client à partir d'un téléphone saisi librement, pour
 * dédoublonner ("07 …", "+225 07 …", "00225 07 …" → même clé).
 *
 * Souple : on privilégie la forme E.164 (`+225…`) quand le numéro est reconnu ;
 * sinon on retombe sur les chiffres bruts (≥ 6) pour rester tolérant aux saisies
 * caisse atypiques. Retourne null si rien d'exploitable.
 */
export function customerPhoneKey(
  raw: string | null | undefined
): string | null {
  if (!raw) return null;
  const e164 = normalizeIvorianPhone(raw);
  if (e164) return e164;
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 6 ? digits : null;
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
