// lib/jeko/reference.ts
//
// Référence envoyée à Jèko : `<référence commande>-<tentative>`. Une relance du
// paiement crée une nouvelle demande Jèko, qui refuse une référence déjà utilisée
// (409 `payment_request_exists_with_reference`) : le numéro de tentative la rend
// unique. Le webhook retrouve la commande en lisant la référence, ce qui reste
// vrai pour une tentative antérieure qui aboutit après une relance.
//
// Format d'une référence commande : `EBA-YYYYMMDD-XXXX` (cf. generateOrderReference
// dans lib/orders.ts) — 17 caractères, donc dans la plage 5 à 100 de Jèko.

const JEKO_REFERENCE = /^(EBA-\d{8}-[A-Z0-9]{4})-([1-9]\d*)$/;

export function buildJekoReference(
  orderReference: string,
  attempt: number
): string {
  if (!Number.isInteger(attempt) || attempt < 1) {
    throw new Error(`Numéro de tentative invalide : ${attempt}`);
  }
  return `${orderReference}-${attempt}`;
}

export function parseJekoReference(
  reference: string
): { orderReference: string; attempt: number } | null {
  const match = JEKO_REFERENCE.exec(reference);
  if (!match) return null;
  return { orderReference: match[1], attempt: Number(match[2]) };
}
