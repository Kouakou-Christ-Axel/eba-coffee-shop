// lib/inventory-count-draft.ts
//
// Modèle du brouillon de comptage : ce qui survit au verrouillage du téléphone.
//
// Compter 117 références debout dans la réserve prend une vingtaine de minutes.
// Jusqu'ici la saisie ne vivait que dans un `useState` : un écran qui s'éteint,
// un onglet recyclé par iOS, un appel entrant, et tout était perdu. C'est, à
// soi seul, une raison suffisante de ne jamais recommencer un inventaire.
//
// Pur (ni React ni Prisma), donc testable — même raison que `lib/expense-item-draft.ts`.
//
// Deux invariants portent tout le reste :
//
//   1. **`''` et `'0'` sont deux états différents.** Vide = non comptée, le
//      stock système reste inchangé. Zéro = comptée, rayon vide, et la
//      consommation de la période est calculée. On stocke donc la saisie BRUTE
//      (string), jamais un nombre — un `0` de repli effacerait la distinction.
//   2. **Un catalogue qui bouge n'invalide jamais le brouillon.** Perdre 90
//      saisies parce que quelqu'un a créé une référence serait exactement le
//      genre de mésaventure qui fait abandonner l'outil.

/** Le brouillon tel qu'il est persisté. */
export type CountDraft = {
  /** Date du comptage saisi (`YYYY-MM-DD`), pas celle du jour. */
  date: string;
  label: string;
  /** `itemId` → saisie brute. Une clé absente = référence non comptée. */
  counts: Record<string, string>;
  /**
   * `itemId` → `currentQuantity` au moment de la saisie. Permet de signaler
   * qu'un réappro est passé sous le comptage en cours : la valeur comptée reste
   * bonne (elle est absolue), mais l'écart affiché a bougé.
   */
  systemAt: Record<string, number>;
  /** Le catalogue tel qu'il était au démarrage, pour détecter les écarts. */
  itemIds: string[];
  startedAt: number;
  updatedAt: number;
};

export type CountLineDraft = {
  itemId: string;
  countedQuantity: number;
};

/** Saisie exploitable ? Vide, non numérique ou négative ⇒ non comptée. */
export function parseCountValue(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

/** Nombre de références effectivement comptées. */
export function countEntered(counts: Record<string, string>): number {
  let n = 0;
  for (const raw of Object.values(counts)) {
    if (parseCountValue(raw) !== null) n++;
  }
  return n;
}

/**
 * Lignes prêtes pour `recordInventoryCount`, dans l'ordre d'affichage fourni.
 *
 * Les références non comptées sont simplement absentes : c'est ce qui rend le
 * comptage partiel possible, et c'est précisément ce que l'écran de
 * récapitulatif doit énoncer avant de valider.
 */
export function draftToLines(
  counts: Record<string, string>,
  orderedItemIds: string[]
): CountLineDraft[] {
  const lines: CountLineDraft[] = [];
  for (const itemId of orderedItemIds) {
    const value = parseCountValue(counts[itemId]);
    if (value === null) continue;
    lines.push({ itemId, countedQuantity: value });
  }
  return lines;
}

export type DraftReconciliation = {
  draft: CountDraft;
  /** Références saisies puis archivées : leurs saisies sont retirées. */
  removedIds: string[];
  /** Références créées depuis le début du comptage. */
  addedIds: string[];
  /** Références dont le stock système a bougé sous la saisie. */
  movedIds: string[];
};

/**
 * Réaccorde un brouillon avec le catalogue courant.
 *
 * Trois écarts possibles, aucun n'est fatal : une référence archivée perd sa
 * saisie (elle n'est plus comptable), une référence nouvelle apparaît comme non
 * comptée, une référence réapprovisionnée entre-temps est signalée. Le reste du
 * brouillon est conservé tel quel.
 */
export function reconcileDraft(
  draft: CountDraft,
  items: { id: string; currentQuantity: number }[]
): DraftReconciliation {
  const liveIds = new Set(items.map((it) => it.id));
  const draftIds = new Set(draft.itemIds);

  const counts: Record<string, string> = {};
  const systemAt: Record<string, number> = {};
  const removedIds: string[] = [];
  for (const [itemId, raw] of Object.entries(draft.counts)) {
    if (!liveIds.has(itemId)) {
      if (parseCountValue(raw) !== null) removedIds.push(itemId);
      continue;
    }
    counts[itemId] = raw;
    if (itemId in draft.systemAt) systemAt[itemId] = draft.systemAt[itemId];
  }

  const movedIds: string[] = [];
  for (const item of items) {
    const seen = systemAt[item.id];
    if (
      seen !== undefined &&
      parseCountValue(counts[item.id]) !== null &&
      seen !== item.currentQuantity
    ) {
      movedIds.push(item.id);
    }
  }

  const addedIds = items.map((it) => it.id).filter((id) => !draftIds.has(id));

  return {
    draft: {
      ...draft,
      counts,
      systemAt,
      itemIds: items.map((it) => it.id),
    },
    removedIds,
    addedIds,
    movedIds,
  };
}

/** Un brouillon oublié depuis trop longtemps ne doit pas ressurgir. */
export function isDraftStale(
  draft: CountDraft,
  now: number,
  maxAgeMs: number
): boolean {
  return now - draft.updatedAt > maxAgeMs;
}

export type CountDiff = {
  itemId: string;
  counted: number;
  system: number;
  /** `counted − system`. */
  delta: number;
  /**
   * Plus trouvé en rayon que le stock théorique.
   *
   * En inventaire périodique, `currentQuantity` vaut exactement « dernier
   * comptage + achats non annulés depuis » — rien d'autre ne l'écrit. Un surplus
   * ne peut donc pas être une consommation négative : c'est une entrée qui n'a
   * pas été enregistrée, et le récapitulatif doit le dire avant de figer le
   * registre.
   */
  surplus: boolean;
};

/** Écarts d'un brouillon, du plus gros au plus petit en valeur absolue. */
export function computeDiffs(
  counts: Record<string, string>,
  items: { id: string; currentQuantity: number }[]
): CountDiff[] {
  const diffs: CountDiff[] = [];
  for (const item of items) {
    const counted = parseCountValue(counts[item.id]);
    if (counted === null) continue;
    const delta = counted - item.currentQuantity;
    if (delta === 0) continue;
    diffs.push({
      itemId: item.id,
      counted,
      system: item.currentQuantity,
      delta,
      surplus: delta > 0,
    });
  }
  return diffs.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}
