// lib/cash-closing-compute.ts
//
// Calcul pur de la clôture de caisse (sans Prisma) — partagé par le formulaire
// client (calcul en direct) et la mutation serveur (valeurs figées).
//
//   caisse théorique = fond de caisse + ventes espèces − dépenses espèces
//                      − remboursements rendus en espèces
//   écart            = espèces comptées − caisse théorique

export type ClosingResult = {
  expectedCash: number;
  difference: number;
};

export function computeClosing(params: {
  openingFloat: number;
  cashSales: number;
  cashExpenses: number;
  cashRefunds: number;
  countedCash: number;
}): ClosingResult {
  const expectedCash =
    params.openingFloat +
    params.cashSales -
    params.cashExpenses -
    params.cashRefunds;
  return {
    expectedCash,
    difference: params.countedCash - expectedCash,
  };
}
