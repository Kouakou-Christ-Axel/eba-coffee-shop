// Réservations de stock par ressource — clés et calculs PURS (aucun accès base).
//
// Une « ressource » est un produit ou une option de supplément ; on les désigne
// par une clé `PRODUCT:<id>` / `OPTION:<id>` pour les ranger dans une même Map.

export type HoldKind = 'PRODUCT' | 'OPTION';

/** Quantités par clé de ressource (besoin, déjà réservé, à réserver…). */
export type HoldMap = Map<string, number>;

export function holdKey(kind: HoldKind, id: string): string {
  return `${kind}:${id}`;
}

export function parseHoldKey(key: string): { kind: HoldKind; id: string } {
  const sep = key.indexOf(':');
  return { kind: key.slice(0, sep) as HoldKind, id: key.slice(sep + 1) };
}

/** Besoin total d'une commande (cf. `aggregateStockNeeds`) rangé par clé de ressource. */
export function needsToMap(agg: {
  products: Map<string, { needed: number }>;
  options: Map<string, { needed: number }>;
}): HoldMap {
  const map: HoldMap = new Map();
  for (const [id, n] of agg.products) map.set(holdKey('PRODUCT', id), n.needed);
  for (const [id, n] of agg.options) map.set(holdKey('OPTION', id), n.needed);
  return map;
}

/**
 * Ce qu'on peut réserver MAINTENANT pour une commande : pour chaque ressource,
 * `min(besoin − déjà réservé, stock disponible)`. `null` = stock illimité (rien à
 * réserver, jamais en manque) ; clé absente de `stock` = ressource disparue
 * (ignorée). Les quantités sont entières : on réserve des unités, pas des fractions.
 */
export function computeHolds(
  needs: HoldMap,
  held: HoldMap,
  stock: Map<string, number | null>
): HoldMap {
  const toHold: HoldMap = new Map();
  for (const [key, needed] of needs) {
    const missing = needed - (held.get(key) ?? 0);
    if (missing <= 0) continue;
    const available = stock.get(key);
    if (available === null || available === undefined) continue;
    const take = Math.min(missing, available);
    if (take > 0) toHold.set(key, take);
  }
  return toHold;
}

/**
 * Vrai quand chaque ressource de la commande est couverte, soit par une
 * réservation, soit parce qu'elle est à stock illimité : la commande peut partir
 * en cuisine sans rien décompter de plus.
 */
export function isFullyHeld(
  needs: HoldMap,
  held: HoldMap,
  stock: Map<string, number | null>
): boolean {
  for (const [key, needed] of needs) {
    if ((held.get(key) ?? 0) >= needed) continue;
    if (stock.get(key) === null) continue;
    return false;
  }
  return true;
}
