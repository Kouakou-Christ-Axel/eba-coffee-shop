// lib/expense-units.ts
//
// Unités de base du référentiel d'articles de dépense (ExpenseArticle.baseUnit)
// et conversion d'une saisie « format d'achat » (ex. 2 cartons de 24) vers
// cette unité de base (ExpenseItem.qtyBase). Deux familles convertibles entre
// elles (masse : kg ↔ g, volume : L ↔ mL) ; `unite` est une unité atomique
// (pièce, carton…) sans conversion possible vers/depuis les deux autres
// familles.

/** Unités de base acceptées pour `ExpenseArticle.baseUnit` (validation Zod). */
export const BASE_UNITS = ['kg', 'g', 'L', 'mL', 'unite'] as const;

export type BaseUnit = (typeof BASE_UNITS)[number];

type UnitFactor = {
  /** Famille dimensionnelle (masse/volume/unité) : conversion impossible entre familles. */
  family: 'mass' | 'volume' | 'unit';
  /** Facteur multiplicatif vers l'unité canonique de la famille (g pour la masse, mL pour le volume). */
  toCanonical: number;
};

// Unité canonique de chaque famille : g (masse), mL (volume), unite (identité).
// `kg`/`L` valent 1000× leur unité canonique respective.
const UNIT_FACTORS: Record<string, UnitFactor> = {
  kg: { family: 'mass', toCanonical: 1000 },
  g: { family: 'mass', toCanonical: 1 },
  L: { family: 'volume', toCanonical: 1000 },
  mL: { family: 'volume', toCanonical: 1 },
  unite: { family: 'unit', toCanonical: 1 },
};

/**
 * Unité de base d'article (`BASE_UNITS`) → unité d'inventaire (`InventoryUnit`).
 * Miroir de `INVENTORY_UNIT_TO_BASE` (lib/expense-mutations.ts) : sert à
 * pré-remplir l'unité quand on crée une référence d'inventaire directement
 * depuis les réglages d'un article. `null`/inconnu retombe sur `UNIT`.
 */
export const BASE_UNIT_TO_INVENTORY: Record<BaseUnit, string> = {
  kg: 'KG',
  g: 'G',
  L: 'L',
  mL: 'ML',
  unite: 'UNIT',
};

/** Arrondi à 3 décimales (cohérent avec la colonne `@db.Decimal(12, 3)`). */
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Convertit une saisie « format d'achat » (`formatQty` unités de `formatSize`,
 * exprimées dans `unit`) en quantité dans l'unité de base de l'article
 * (`baseUnit`). Ex. { formatQty: 2, formatSize: 25, unit: 'kg', baseUnit: 'g' }
 * (2 sacs de 25 kg) → 50000 (g).
 *
 * Renvoie `null` quand la conversion n'est pas possible (dimensions
 * incompatibles, ex. kg → unite) — l'appelant laisse alors `qtyBase` à `null`
 * plutôt que de stocker une valeur erronée.
 */
export function toBaseQty({
  formatQty,
  formatSize,
  unit,
  baseUnit,
}: {
  formatQty?: number | null;
  formatSize?: number | null;
  unit?: string | null;
  baseUnit?: string | null;
}): number | null {
  if (formatQty == null || !Number.isFinite(formatQty)) return null;
  if (!baseUnit) return null;

  const size = formatSize ?? 1;
  const rawQty = formatQty * size;

  // Pas d'unité de saisie renseignée : on suppose qu'elle est déjà exprimée
  // dans l'unité de base de l'article (pas de conversion à faire).
  if (!unit || unit === baseUnit) return round3(rawQty);

  const from = UNIT_FACTORS[unit];
  const to = UNIT_FACTORS[baseUnit];
  if (!from || !to || from.family !== to.family) return null;

  return round3((rawQty * from.toCanonical) / to.toCanonical);
}

/**
 * Convertit un prix exprimé PAR unité de `fromUnit` vers un prix PAR unité de
 * `toUnit` (mêmes familles dimensionnelles que `toBaseQty`). Ex.
 * { price: 900, fromUnit: 'kg', toUnit: 'g' } → 900 F/kg = 0,9 F/g → `null`.
 *
 * Sert à pré-remplir le prix unitaire d'une ligne de dépense depuis le prix
 * moyen d'un article, qui est exprimé dans son `baseUnit` alors que la ligne
 * peut être saisie dans une autre unité de la même famille.
 *
 * Renvoie `null` quand la conversion est impossible (unité inconnue, familles
 * incompatibles, prix absent) **ou** quand le résultat arrondi tomberait à 0 :
 * `ExpenseItem.unitPrice` est un entier de francs, et un PU à 0 F fausserait le
 * montant calculé bien plus qu'il n'aiderait la saisie.
 */
export function convertUnitPrice({
  price,
  fromUnit,
  toUnit,
}: {
  price?: number | null;
  fromUnit?: string | null;
  toUnit?: string | null;
}): number | null {
  if (price == null || !Number.isFinite(price) || price < 0) return null;

  // Pas d'unité de part et d'autre : le prix est déjà dans la bonne unité.
  if (!fromUnit || !toUnit || fromUnit === toUnit) {
    return price >= 1 ? Math.round(price) : null;
  }

  const from = UNIT_FACTORS[fromUnit];
  const to = UNIT_FACTORS[toUnit];
  if (!from || !to || from.family !== to.family) return null;

  // Un prix est l'inverse d'une quantité : 900 F/kg → 0,9 F/g, donc on divise
  // par le rapport des facteurs (et non l'inverse comme dans `toBaseQty`).
  const exact = (price * to.toCanonical) / from.toCanonical;

  // Tester la valeur EXACTE, pas l'arrondi : `Math.round(0,9)` vaut 1, et
  // suggérer 1 F/g pour un article à 0,9 F/g gonflerait le montant de 11 %.
  return exact >= 1 ? Math.round(exact) : null;
}
