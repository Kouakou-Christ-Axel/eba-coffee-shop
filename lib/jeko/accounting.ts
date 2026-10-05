// lib/jeko/accounting.ts
//
// Comptabilité du solde Jèko (pur). Trois coûts distincts :
//   - frais CLIENT   : `onlineFee` (1 %), payés en plus par le client ;
//   - frais JÈKO     : `gatewayFee`, prélevés à l'encaissement (≈ 1,5 %) ;
//   - frais de RETRAIT : prélevés quand on vide le compte.
// Le coût réel pour EBA à l'encaissement est frais Jèko − frais client (≈ 0,5 %).

/** Frais de retrait, en % du montant retiré. Déduit de deux observations réelles :
 * retirer 99 F débite 101 F, retirer 1 000 F débite 1 015 F → 1,5 % arrondi au
 * supérieur. À confirmer sur un troisième retrait. */
export const WITHDRAWAL_FEE_PERCENT = 1.5;

function assertAmount(amount: number) {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error(`Montant invalide : ${amount}`);
  }
}

export function withdrawalFee(amount: number): number {
  assertAmount(amount);
  // Points de base entiers : évite 1000 × 1,5 / 100 = 15,000000000000002 → 16.
  return Math.ceil(
    (amount * Math.round(WITHDRAWAL_FEE_PERCENT * 100)) / 10_000
  );
}

/** Ce qui est débité du compte pour retirer `amount`. */
export function withdrawalDebit(amount: number): number {
  return amount + withdrawalFee(amount);
}

/** Plus gros montant retirable avec un solde donné, frais compris. */
export function maxWithdrawable(balance: number): number {
  assertAmount(balance);
  // Estimation puis ajustement : l'arrondi au supérieur peut décaler d'1 F.
  let w = Math.floor(
    (balance * 10_000) / (10_000 + Math.round(WITHDRAWAL_FEE_PERCENT * 100))
  );
  while (withdrawalDebit(w + 1) <= balance) w++;
  while (w > 0 && withdrawalDebit(w) > balance) w--;
  return w;
}

export type OnlinePaymentRow = {
  total: number;
  onlineFee: number | null;
  gatewayFee: number | null;
  paymentAmountDue: number | null;
};

export function summarizeOnlinePayments(rows: OnlinePaymentRow[]) {
  let collected = 0;
  let customerFees = 0;
  let gatewayFees = 0;
  let feeUnknownCount = 0;
  for (const r of rows) {
    const fee = r.onlineFee ?? 0;
    // Montant réellement demandé à Jèko ; `total` seul serait faux après une
    // annulation client (qui remet `total` au prix brut).
    collected += r.paymentAmountDue ?? r.total + fee;
    customerFees += fee;
    if (r.gatewayFee == null) feeUnknownCount++;
    else gatewayFees += r.gatewayFee;
  }
  return {
    count: rows.length,
    collected,
    customerFees,
    gatewayFees,
    absorbedFees: gatewayFees - customerFees,
    netReceived: collected - gatewayFees,
    feeUnknownCount,
  };
}

/** Solde attendu sur Jèko : net reçu moins chaque retrait et ses frais. */
export function jekoBalance(
  netReceived: number,
  withdrawals: { amount: number; fee: number }[]
): number {
  return withdrawals.reduce((s, w) => s - w.amount - w.fee, netReceived);
}
