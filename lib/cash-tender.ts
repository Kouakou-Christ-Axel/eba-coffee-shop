// lib/cash-tender.ts
//
// Aide au rendu de monnaie en espèces. Purement une aide de comptoir : le
// montant encaissé envoyé au serveur reste le montant dû (`setOrderPayment`
// exige une somme exacte), seul l'affichage du rendu change.
//
// Pur, sans dépendance React : testable en isolation.

/** Coupures courantes en FCFA, de la plus petite à la plus grande. */
const CFA_NOTES = [500, 1000, 2000, 5000, 10000] as const;

/** Arrondis supérieurs proposés en plus des coupures (« le client donne 3 500 »). */
const ROUNDING_STEPS = [500, 1000, 5000] as const;

/**
 * Montants « reçus » plausibles pour un montant dû, du plus petit au plus
 * grand. N'inclut jamais l'appoint exact : l'UI le propose à part, car c'est
 * le cas le plus fréquent et il mérite son propre libellé.
 *
 * Combine deux intuitions de caissier :
 *   - les arrondis supérieurs (3 200 → 3 500, 4 000, 5 000) ;
 *   - les coupures uniques au-dessus du montant (3 200 → 5 000, 10 000).
 */
export function suggestCashTenders(amount: number, max = 4): number[] {
  if (!Number.isFinite(amount) || amount <= 0) return [];

  const candidates = new Set<number>();
  for (const step of ROUNDING_STEPS) {
    const rounded = Math.ceil(amount / step) * step;
    if (rounded > amount) candidates.add(rounded);
  }
  for (const note of CFA_NOTES) {
    if (note > amount) candidates.add(note);
  }

  return [...candidates].sort((a, b) => a - b).slice(0, max);
}

/**
 * Rendu à remettre au client, ou `null` tant que le montant reçu ne couvre pas
 * le dû (rien à afficher — ce n'est pas une erreur, le caissier saisit encore).
 */
export function computeChange(amount: number, tendered: number): number | null {
  if (!Number.isFinite(tendered) || tendered < amount) return null;
  return tendered - amount;
}
