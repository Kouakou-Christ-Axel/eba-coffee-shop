// lib/contact-links.ts
//
// Helpers pour générer les liens de contact externes (tel:, wa.me, pay.wave.com).
// Pas d'intégration API tierce — uniquement de la construction d'URL.
//
// Le numéro WhatsApp doit être au format E.164 sans le `+` (cf. wa.me).
// Voir lib/phone.ts pour la normalisation.

import { normalizeIvorianPhone, toWhatsAppNumber } from '@/lib/phone';
import type { CartItem } from '@/lib/cart-store';
import { getItemGross, getItemNet } from '@/lib/orders/totals';
import { formatSupplementLabel } from '@/lib/orders/format';
import type { LoyaltyRecapInfo } from '@/lib/loyalty';

const priceFormatter = new Intl.NumberFormat('fr-FR');

const WAVE_BASE_URL = 'https://pay.wave.com/m';
const WAVE_COUNTRY_SEGMENT = 'c/ci';

/** Lien tel: pour passer un appel direct. */
export function buildTelLink(phone: string | null): string | null {
  if (!phone) return null;
  const normalized = normalizeIvorianPhone(phone);
  return normalized ? `tel:${normalized}` : null;
}

/** Lien wa.me avec message préformaté (encodé URI). */
export function buildWhatsAppLink(
  phone: string | null,
  message?: string
): string | null {
  if (!phone) return null;
  const normalized = normalizeIvorianPhone(phone);
  if (!normalized) return null;
  const waNumber = toWhatsAppNumber(normalized);
  const base = `https://wa.me/${waNumber}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/**
 * Lien wa.me SANS destinataire : WhatsApp ouvre le sélecteur de contact avec le
 * message pré-rempli. Sert au client pour transférer les infos de retrait à son
 * livreur quand on ne connaît pas (encore) le numéro de celui-ci.
 */
export function buildWhatsAppShareLink(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/**
 * Construit le lien Wave pour un montant donné.
 * Format : https://pay.wave.com/m/<MERCHANT_ID>/c/ci/?amount=<montant>
 *
 * Le montant est en franc CFA, entier. Le merchant ID vient de l'env
 * `NEXT_PUBLIC_WAVE_MERCHANT_ID`. Renvoie null si non configuré.
 */
export function buildWaveLink(amount: number): string | null {
  const merchantId = process.env.NEXT_PUBLIC_WAVE_MERCHANT_ID;
  if (!merchantId) return null;
  return `${WAVE_BASE_URL}/${merchantId}/${WAVE_COUNTRY_SEGMENT}/?amount=${amount}`;
}

function formatItemLine(item: CartItem): string {
  const gross = getItemGross(item);
  const net = getItemNet(item);
  const supplementsLabel =
    item.supplements.length > 0
      ? ` (${item.supplements.map(formatSupplementLabel).join(', ')})`
      : '';
  const priceLabel =
    gross !== net
      ? `${priceFormatter.format(net)} F (remise -${priceFormatter.format(gross - net)} F)`
      : `${priceFormatter.format(net)} F`;
  return `- ${item.quantity}× ${item.productName}${supplementsLabel} : ${priceLabel}`;
}

/** Bloc marketing fidélité, ajouté au récap client quand pertinent (cf. `LoyaltyRecapInfo`). */
function formatLoyaltyLine(loyalty: LoyaltyRecapInfo | null): string | null {
  if (!loyalty) return null;
  switch (loyalty.kind) {
    case 'reward_applied':
      return `🎁 Récompense fidélité appliquée : -${priceFormatter.format(loyalty.amount)} F sur cette commande. Merci pour ta fidélité !`;
    case 'reward_available':
      return `🎁 Tu as une récompense fidélité de ${priceFormatter.format(loyalty.amount)} F disponible — à réclamer à ta prochaine visite !`;
    case 'progress': {
      const remaining = Math.max(1, loyalty.stampsPerCard - loyalty.stampCount);
      return `☕ Fidélité : ${loyalty.stampCount}/${loyalty.stampsPerCard} tampons. Encore ${remaining} commande${remaining > 1 ? 's' : ''} et une réduction t'attend !`;
    }
    case 'anonymous':
      return '💡 Donne ton numéro à ta prochaine commande pour cumuler des points et profiter de réductions fidélité !';
  }
}

/**
 * Message WhatsApp pour demander un paiement Wave. Inclut le détail des
 * articles, le total, et le lien Wave avec le montant déjà pré-rempli.
 * Si le merchant ID n'est pas configuré, un placeholder remplace le lien.
 * `loyalty` (optionnel) ajoute un message marketing fidélité (cf. `lib/loyalty.ts`).
 */
export function buildWaveRequestMessage(params: {
  customerName: string | null;
  dailyNumber: number;
  amount: number;
  items: CartItem[];
  loyalty?: LoyaltyRecapInfo | null;
}): string {
  const { customerName, dailyNumber, amount, items, loyalty } = params;
  const greeting = customerName ? `Bonjour ${customerName}` : 'Bonjour';
  const number = String(dailyNumber).padStart(3, '0');
  const itemsBlock = items.map(formatItemLine).join('\n');
  const waveLink = buildWaveLink(amount);
  const linkBlock = waveLink
    ? `Paye via Wave en cliquant sur ce lien :\n${waveLink}`
    : 'Paye via Wave : [lien à compléter]';
  const loyaltyLine = formatLoyaltyLine(loyalty ?? null);

  return [
    `${greeting},`,
    '',
    `Voici le récap de ta commande EBA #${number} :`,
    itemsBlock,
    '',
    `Total : ${priceFormatter.format(amount)} F`,
    ...(loyaltyLine ? ['', loyaltyLine] : []),
    '',
    linkBlock,
    '',
    'Merci !',
  ].join('\n');
}

/**
 * Message que le CLIENT envoie à la boutique (depuis la page de suivi)
 * pour signaler son paiement — il joint sa capture d'écran dans WhatsApp
 * juste après (un lien wa.me ne peut pas joindre une image automatiquement).
 * Permet à la caisse de valider manuellement dans le dashboard.
 */
export function buildPaymentProofMessage(params: {
  customerName: string | null;
  dailyNumber: number;
  amount: number;
}): string {
  const { customerName, dailyNumber, amount } = params;
  const greeting = customerName ? `Bonjour, ici ${customerName}` : 'Bonjour';
  const number = String(dailyNumber).padStart(3, '0');
  return [
    `${greeting}.`,
    `Je viens de payer ma commande EBA #${number} (${priceFormatter.format(amount)} F).`,
    "Je t'envoie la capture de mon paiement juste après ce message.",
  ].join('\n');
}

/** Message "ta commande est prête" via WhatsApp. */
export function buildPickupReadyMessage(params: {
  customerName: string | null;
  dailyNumber: number;
  /** Code de retrait (suffixe de la référence) à annoncer au comptoir. */
  pickupCode?: string;
  /** URL publique de suivi (/commande/:id) à joindre au message. */
  trackingUrl?: string;
}): string {
  const { customerName, dailyNumber, pickupCode, trackingUrl } = params;
  const greeting = customerName ? `Bonjour ${customerName}` : 'Bonjour';
  const number = String(dailyNumber).padStart(3, '0');
  const lines = [
    `${greeting}, ta commande EBA #${number} est prête. Tu peux venir ou envoyer ton livreur.`,
  ];
  if (pickupCode) lines.push(`Code de retrait à annoncer : ${pickupCode}`);
  if (trackingUrl) lines.push(`Infos et localisation : ${trackingUrl}`);
  lines.push('À tout de suite !');
  return lines.join('\n');
}

/** Message demande de feedback post-livraison. */
export function buildFeedbackMessage(params: {
  customerName: string | null;
}): string {
  const { customerName } = params;
  const greeting = customerName ? `Bonjour ${customerName}` : 'Bonjour';
  return `${greeting}, merci pour ta commande EBA Coffee Shop ! Comment as-tu trouvé ? Ton retour nous aide à nous améliorer. À bientôt ☕`;
}

/** Message pour demander au client d'envoyer son livreur. */
export function buildDriverRequestMessage(params: {
  customerName: string | null;
  dailyNumber: number;
}): string {
  const { customerName, dailyNumber } = params;
  const greeting = customerName ? `Bonjour ${customerName}` : 'Bonjour';
  const number = String(dailyNumber).padStart(3, '0');
  return `${greeting}, ta commande EBA #${number} est bientôt prête. Tu peux envoyer ton livreur dès maintenant.`;
}

/**
 * Message que le CLIENT transfère à son livreur depuis la page de suivi :
 * code de retrait (identifiant terrain, unique contrairement au n° du jour),
 * adresse + lien Maps (pour estimer la course avant de partir) et lien de
 * suivi (statut en direct — inutile de se déplacer avant « Prête »).
 */
export function buildDriverShareMessage(params: {
  pickupCode: string;
  customerName: string | null;
  pickupAddress: string | null;
  pickupMapsUrl: string | null;
  trackingUrl: string;
}): string {
  const {
    pickupCode,
    customerName,
    pickupAddress,
    pickupMapsUrl,
    trackingUrl,
  } = params;
  const who = customerName ? `la commande de ${customerName}` : 'ma commande';

  const lines = [
    `Bonjour, tu récupères ${who} chez EBA Coffee Shop.`,
    '',
    `Code de retrait à donner au comptoir : ${pickupCode}`,
  ];
  if (pickupAddress) lines.push(`Adresse : ${pickupAddress}`);
  if (pickupMapsUrl) lines.push(`Localisation : ${pickupMapsUrl}`);
  lines.push(
    '',
    `Statut en direct (pars quand c'est « Prête ») : ${trackingUrl}`
  );
  return lines.join('\n');
}
