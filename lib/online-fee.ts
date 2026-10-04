// lib/online-fee.ts
//
// Frais de paiement en ligne facturés au client (Jèko Checkout). Calculés côté
// serveur : `ceil(total × taux)` en FCFA entiers. Le taux est exprimé en
// pourcentage et converti en points de base entiers, sinon `1000 × 1,1 / 100`
// donne 11,000000000000002 en flottant et le `ceil` facture un FCFA de trop.

export function computeOnlineFee(total: number, ratePercent: number): number {
  if (!Number.isInteger(total) || total < 0) {
    throw new Error(`Total invalide pour le calcul des frais : ${total}`);
  }
  if (!Number.isFinite(ratePercent) || ratePercent < 0) {
    throw new Error(`Taux de frais invalide : ${ratePercent}`);
  }
  const basisPoints = Math.round(ratePercent * 100);
  return Math.ceil((total * basisPoints) / 10_000);
}

/**
 * Net, frais et montant à payer pour un total net donné. Même règle que le
 * serveur (`computeOnlineFee`) : le client voit les frais AVANT de cliquer. Une
 * commande entièrement couverte par une récompense n'a rien à payer, donc aucun
 * frais.
 */
export function withOnlineFee(
  netTotal: number,
  feePercent: number
): { netTotal: number; fee: number; amountDue: number } {
  const fee = netTotal > 0 ? computeOnlineFee(netTotal, feePercent) : 0;
  return { netTotal, fee, amountDue: netTotal + fee };
}
