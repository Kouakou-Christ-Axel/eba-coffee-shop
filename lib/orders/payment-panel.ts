// lib/orders/payment-panel.ts
//
// Logique PURE de la section « Paiement » de la page de suivi : quel état
// afficher, compte à rebours, lecture du retour de chez Jèko, messages d'erreur.
// Le composant (components/(public)/commande/payment-section.tsx) n'ajoute que du
// JSX : tout ce qui peut se tromper est ici, et testé. Sans import serveur : ce
// module est chargé côté navigateur.

import type { PublicOrderView } from '@/lib/orders';

/** Retour de chez Jèko, lu dans `?paiement=` (écrit par `startJekoPayment`).
 * `indisponible` est écrit par le checkout quand Jèko n'a pas pu créer le paiement. */
export type PaymentReturn = 'ok' | 'echec' | 'indisponible' | null;

export type PaymentPanelKind =
  | 'paid' // payée, la commande suit son cours
  | 'late_paid' // payée APRÈS annulation ou expiration : le staff la rétablit
  | 'nothing_due' // récompense fidélité qui couvre tout
  | 'deposit_paid' // acompte versé (commande de caisse), solde au comptoir
  | 'verifying' // retour de chez Jèko avec succès, confirmation en cours
  | 'failed' // retour de chez Jèko avec un échec : le client peut réessayer
  | 'pending' // en attente, compte à rebours, payer / reprendre
  | 'expired' // délai dépassé
  | 'counter'; // aucun paiement en ligne : à régler au comptoir

type PanelOrder = Pick<
  PublicOrderView,
  'isPaid' | 'status' | 'total' | 'depositRequired' | 'depositPaid' | 'payment'
>;

export function getPaymentPanelKind(
  order: PanelOrder,
  paymentReturn: PaymentReturn
): PaymentPanelKind {
  if (order.isPaid) {
    return order.status === 'CANCELLED' ? 'late_paid' : 'paid';
  }
  // Récompense fidélité couvrant tout le total : proposer « Payer 0 F » n'aurait
  // aucun sens.
  if (order.total <= 0) return 'nothing_due';

  if (order.payment.state === 'expired') return 'expired';
  if (order.payment.state === 'pending') {
    if (paymentReturn === 'ok') return 'verifying';
    if (paymentReturn === 'echec' || paymentReturn === 'indisponible') {
      return 'failed';
    }
    return 'pending';
  }

  if (
    order.depositRequired != null &&
    (order.depositPaid ?? 0) >= order.depositRequired
  ) {
    return 'deposit_paid';
  }
  return 'counter';
}

/** Seules trois valeurs sont écrites par l'application ; tout le reste est ignoré
 * (un lien trafiqué ne doit rien changer à l'affichage). */
export function parsePaymentReturn(
  value: string | string[] | undefined
): PaymentReturn {
  if (value === 'ok') return 'ok';
  if (value === 'echec') return 'echec';
  if (value === 'indisponible') return 'indisponible';
  return null;
}

/** `m:ss`, arrondi à la seconde SUPÉRIEURE (jamais 0:00 tant qu'il reste du
 * temps), sans descendre sous zéro. */
export function formatCountdown(msLeft: number): string {
  const total = Math.max(0, Math.ceil(msLeft / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

/** Heure limite (HH:MM, Abidjan) jusqu'à laquelle la commande peut encore être
 * payée ou relancée. `null` sans échéance. */
export function formatRetryDeadline(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  return new Date(expiresAt).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Abidjan',
  });
}

/** Message affiché quand `POST /api/commandes/:id/paiement` échoue. Jamais le
 * texte brut du serveur : on aiguille sur `code`/`reason`. */
export function paymentStartErrorMessage(
  status: number,
  data: { code?: string; reason?: string }
): string {
  if (status === 429) {
    return 'Trop de tentatives : réessaie dans quelques minutes.';
  }
  if (data.code === 'CONFLICT') {
    if (data.reason === 'expired') {
      return 'Le délai de paiement est dépassé : cette commande a expiré. Passe une nouvelle commande.';
    }
    if (data.reason === 'out_of_stock') {
      return 'Un article de ta commande n’est plus disponible. Tu n’as pas été débité : annule cette commande et recommande sans cet article.';
    }
    if (data.reason === 'already_paid') return 'Cette commande est déjà payée.';
    if (data.reason === 'cancelled') return 'Cette commande a été annulée.';
  }
  if (
    data.code === 'PAYMENT_PROVIDER_ERROR' ||
    status === 502 ||
    status === 503
  ) {
    return 'Le paiement en ligne est momentanément indisponible. Réessaie dans un instant.';
  }
  return 'Impossible de lancer le paiement. Réessaie dans un instant.';
}
