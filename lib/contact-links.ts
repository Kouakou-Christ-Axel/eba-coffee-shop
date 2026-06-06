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
      ? ` (${item.supplements.map((s) => s.optionName).join(', ')})`
      : '';
  const priceLabel =
    gross !== net
      ? `${priceFormatter.format(net)} F (remise -${priceFormatter.format(gross - net)} F)`
      : `${priceFormatter.format(net)} F`;
  return `- ${item.quantity}× ${item.productName}${supplementsLabel} : ${priceLabel}`;
}

/**
 * Message WhatsApp pour demander un paiement Wave. Inclut le détail des
 * articles, le total, et le lien Wave avec le montant déjà pré-rempli.
 * Si le merchant ID n'est pas configuré, un placeholder remplace le lien.
 */
export function buildWaveRequestMessage(params: {
  customerName: string | null;
  dailyNumber: number;
  amount: number;
  items: CartItem[];
}): string {
  const { customerName, dailyNumber, amount, items } = params;
  const greeting = customerName ? `Bonjour ${customerName}` : 'Bonjour';
  const number = String(dailyNumber).padStart(3, '0');
  const itemsBlock = items.map(formatItemLine).join('\n');
  const waveLink = buildWaveLink(amount);
  const linkBlock = waveLink
    ? `Paye via Wave en cliquant sur ce lien :\n${waveLink}`
    : 'Paye via Wave : [lien à compléter]';

  return [
    `${greeting},`,
    '',
    `Voici le récap de ta commande EBA #${number} :`,
    itemsBlock,
    '',
    `Total : ${priceFormatter.format(amount)} F`,
    '',
    linkBlock,
    '',
    'Merci !',
  ].join('\n');
}

/** Message "ta commande est prête" via WhatsApp. */
export function buildPickupReadyMessage(params: {
  customerName: string | null;
  dailyNumber: number;
}): string {
  const { customerName, dailyNumber } = params;
  const greeting = customerName ? `Bonjour ${customerName}` : 'Bonjour';
  const number = String(dailyNumber).padStart(3, '0');
  return `${greeting}, ta commande EBA #${number} est prête. À tout de suite !`;
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
