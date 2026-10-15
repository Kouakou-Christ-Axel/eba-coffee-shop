import type { CartItem } from '@/lib/cart-store';
import { getPickupCode } from '@/lib/orders/format';
import { priceFormatter, formatItemLine } from './format';
import { buildWaveLink } from './links';

/** Message WhatsApp pour demander un paiement Wave. */
export function buildWaveRequestMessage(params: {
  customerName: string | null;
  dailyNumber: number;
  reference: string;
  amount: number;
  items: CartItem[];
  loyaltyDiscount?: number | null;
  wavePaymentNumber: string;
  /** Numéro Orange Money pour un paiement manuel, idem. */
  orangeMoneyPaymentNumber: string;
  trackingUrl?: string;
}): string {
  const {
    customerName,
    dailyNumber,
    reference,
    amount,
    items,
    loyaltyDiscount,
    wavePaymentNumber,
    orangeMoneyPaymentNumber,
    trackingUrl,
  } = params;
  const greeting = customerName ? `Bonjour ${customerName} 👋` : 'Bonjour 👋';
  const number = String(dailyNumber).padStart(3, '0');
  const waveLink = buildWaveLink(amount);

  const lines = [greeting, '', `Ta commande #${number} :`];
  lines.push(...items.map(formatItemLine));
  if (loyaltyDiscount && loyaltyDiscount > 0) {
    lines.push(`🎁 Fidélité : -${priceFormatter.format(loyaltyDiscount)} F`);
  }
  lines.push(
    '',
    `💰 Total : ${priceFormatter.format(amount)} F`,
    `🔑 Code : ${getPickupCode(reference)}`,
    '',
    waveLink
      ? `👉 Payer par Wave : ${waveLink}`
      : '👉 Payer par Wave : [lien à compléter]',
    `(ou par numéro : Wave ${wavePaymentNumber} · Orange Money ${orangeMoneyPaymentNumber})`
  );
  if (trackingUrl) lines.push('', `👉 Suivi : ${trackingUrl}`);
  return lines.join('\n');
}

export function buildPaymentReminderMessage(params: {
  customerName: string | null;
  dailyNumber: number;
  /** URL publique de suivi (/commande/:id). */
  trackingUrl: string;
  deadline: string | null;
}): string {
  const { customerName, dailyNumber, trackingUrl, deadline } = params;
  const number = String(dailyNumber).padStart(3, '0');
  return [
    customerName ? `Bonjour ${customerName},` : 'Bonjour,',
    `votre commande #${number} chez EBA Coffee Shop attend son paiement.`,
    `Vous pouvez la régler ici${deadline ? ` avant ${deadline}` : ''} : ${trackingUrl}`,
    'Vous pouvez aussi passer la régler au comptoir.',
  ].join('\n');
}
