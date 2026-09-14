// lib/inventory-count-math.ts
//
// Calcul d'un comptage périodique, extrait de `recordInventoryCount` et rendu
// PUR : aucune dépendance Prisma, donc testable.
//
// Deux raisons à cette extraction :
//
//   1. C'est un registre comptable. `InventoryCountLine` fige la période
//      (ouverture, achats, consommation) et n'est jamais recalculé ensuite —
//      une régression silencieuse y est durable. Elle mérite des tests.
//   2. L'écriture d'origine faisait 5 requêtes SÉQUENTIELLES par ligne dans une
//      transaction interactive (`findUnique` article, `findFirst` comptage
//      précédent, `aggregate` achats, `create` ligne, `update` article). À 117
//      références — le catalogue réel — cela fait ~585 allers-retours, soit
//      ~17 s à 30 ms de latence, pour un `timeout` de 30 s. En sortant le
//      calcul, l'appelant peut charger les mêmes données en quelques requêtes
//      groupées et ne garder que des écritures.
//
// La formule est inchangée : `consommation = ouverture + achats − compté`, et
// `0` au premier comptage d'une référence (il n'y a pas de période antérieure à
// solder, il sert de base).

/** Une saisie physique : ce que le staff a compté sur l'étagère. */
export type CountLineInput = {
  itemId: string;
  countedQuantity: number;
};

/**
 * Une ligne de comptage antérieure. `countDate` est la date du COMPTAGE
 * (`InventoryCount.date`), pas celle de la ligne — c'est elle qui borne la
 * période. `sequence` départage deux comptages du même jour (ordre de création,
 * croissant) : le cas se produit en pratique, plusieurs comptages correctifs
 * pouvant partager une date.
 */
export type PreviousCountLine = {
  itemId: string;
  countedQuantity: number;
  countDate: Date;
  sequence: number;
};

/**
 * Un achat. `canceled` reflète l'annulation du LOT
 * (`InventoryRestockBatch.canceledAt`) : un lot annulé n'est jamais entré en
 * stock, il ne compte pas dans les entrées de la période.
 */
export type PurchaseRow = {
  itemId: string;
  date: Date;
  quantity: number;
  canceled: boolean;
};

/** Une ligne prête à écrire dans `InventoryCountLine`. */
export type ComputedCountLine = {
  itemId: string;
  openingQuantity: number;
  purchasesQuantity: number;
  countedQuantity: number;
  consumption: number;
  unitCostSnapshot: number;
};

export type ComputeCountInput = {
  /** Date du comptage en cours (jour civil, déjà normalisée en UTC). */
  date: Date;
  /** Les saisies, dans l'ordre voulu pour les lignes produites. */
  lines: CountLineInput[];
  /**
   * Lignes de comptage ANTÉRIEURES des articles concernés, toutes périodes
   * confondues. Le tri et la sélection de la plus récente sont faits ici — pas
   * besoin de pré-filtrer côté appelant au-delà de `countDate < date`.
   */
  previousLines: PreviousCountLine[];
  /** Achats des articles concernés. Les hors-période sont ignorés ici. */
  purchases: PurchaseRow[];
  /** PMP courant par `itemId`, figé sur la ligne pour la valorisation. */
  avgUnitCostByItem: Map<string, number>;
};

/**
 * Dernière ligne de comptage STRICTEMENT antérieure à `date`, par article.
 *
 * L'implémentation d'origine faisait un `findFirst` trié sur la seule date du
 * comptage : à dates égales, le gagnant dépendait du plan d'exécution. On
 * départage explicitement par `sequence` (ordre de création), ce qui rend le
 * résultat déterministe et retient bien le comptage le plus récent.
 */
export function latestPreviousByItem(
  previousLines: PreviousCountLine[],
  date: Date
): Map<string, PreviousCountLine> {
  const best = new Map<string, PreviousCountLine>();
  for (const line of previousLines) {
    if (line.countDate.getTime() >= date.getTime()) continue;
    const current = best.get(line.itemId);
    if (
      !current ||
      line.countDate.getTime() > current.countDate.getTime() ||
      (line.countDate.getTime() === current.countDate.getTime() &&
        line.sequence > current.sequence)
    ) {
      best.set(line.itemId, line);
    }
  }
  return best;
}

/**
 * Achats entrés en stock sur la période `]since, date]` d'un article. `since`
 * nul (premier comptage) ⇒ tout ce qui précède `date`.
 *
 * Bornes : ouverte à gauche (les achats du jour du comptage précédent étaient
 * déjà dans la quantité comptée ce jour-là), fermée à droite (ce qui est arrivé
 * le jour du comptage est sur l'étagère au moment où on compte).
 */
function sumPurchases(
  purchases: PurchaseRow[],
  itemId: string,
  since: Date | null,
  date: Date
): number {
  let total = 0;
  for (const p of purchases) {
    if (p.itemId !== itemId) continue;
    if (p.canceled) continue;
    if (p.date.getTime() > date.getTime()) continue;
    if (since !== null && p.date.getTime() <= since.getTime()) continue;
    total += p.quantity;
  }
  return total;
}

/**
 * Transforme les saisies physiques en lignes de registre.
 *
 * Les références absentes de `lines` ne sont pas touchées : un comptage partiel
 * laisse leur stock inchangé et ne leur crée aucune ligne. C'est voulu — sur un
 * catalogue de 117 références, compter en plusieurs fois est la norme.
 */
export function computeCountLines({
  date,
  lines,
  previousLines,
  purchases,
  avgUnitCostByItem,
}: ComputeCountInput): ComputedCountLine[] {
  const previousByItem = latestPreviousByItem(previousLines, date);

  return lines.map((line) => {
    const previous = previousByItem.get(line.itemId) ?? null;
    const openingQuantity = previous ? previous.countedQuantity : 0;
    const since = previous ? previous.countDate : null;
    const purchasesQuantity = sumPurchases(purchases, line.itemId, since, date);

    return {
      itemId: line.itemId,
      openingQuantity,
      purchasesQuantity,
      countedQuantity: line.countedQuantity,
      // Premier comptage = base de départ : rien à solder.
      consumption: previous
        ? openingQuantity + purchasesQuantity - line.countedQuantity
        : 0,
      unitCostSnapshot: avgUnitCostByItem.get(line.itemId) ?? 0,
    };
  });
}

/**
 * Borne basse commune permettant d'aller chercher les achats de TOUS les
 * articles en une seule requête : le plus ancien comptage précédent parmi eux.
 *
 * `null` ⇒ au moins un article n'a jamais été compté ; il faut alors tout son
 * historique d'achats, donc pas de borne basse. Le filtrage fin, article par
 * article, reste fait par `computeCountLines` — cette borne ne sert qu'à ne pas
 * rapatrier des années d'achats inutiles.
 */
export function earliestPreviousDate(
  previousByItem: Map<string, PreviousCountLine>,
  itemIds: string[]
): Date | null {
  let earliest: Date | null = null;
  for (const itemId of itemIds) {
    const previous = previousByItem.get(itemId);
    if (!previous) return null;
    if (!earliest || previous.countDate.getTime() < earliest.getTime()) {
      earliest = previous.countDate;
    }
  }
  return earliest;
}
