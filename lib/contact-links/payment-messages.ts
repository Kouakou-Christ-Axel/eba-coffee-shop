import type { CartItem } from '@/lib/cart-store';
import { getPickupCode } from '@/lib/orders/format';
import { computeCheckoutLoyaltyMessage } from '@/lib/loyalty-messaging';
import type { LoyaltySettings } from '@/lib/loyalty-settings';
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
  /** Repère à indiquer comme destination dans l'appli Yango, idem. */
  yangoLandmark: string;
  /** Lien Google Maps (itinéraire) à joindre pour estimer la course. */
  mapsDirectionsUrl: string;
  trackingUrl?: string;
  loyaltyTeaser?: { settings: LoyaltySettings; stampCount: number } | null;
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
    yangoLandmark,
    mapsDirectionsUrl,
    trackingUrl,
    loyaltyTeaser,
  } = params;
  const greeting = customerName ? `Bonjour ${customerName}` : 'Bonjour';
  const number = String(dailyNumber).padStart(3, '0');
  const itemsBlock = items.map(formatItemLine).join('\n');
  const waveLink = buildWaveLink(amount);
  const waveLine = waveLink
    ? `Wave : ${waveLink}`
    : 'Wave : [lien à compléter]';

  const lines = [`${greeting}, ta commande EBA #${number} :`, itemsBlock];
  if (loyaltyDiscount && loyaltyDiscount > 0) {
    lines.push(`Fidélité 🎁 : -${priceFormatter.format(loyaltyDiscount)} F`);
  }
  lines.push(`Total : ${priceFormatter.format(amount)} F`);
  lines.push(`Code de retrait : ${getPickupCode(reference)}`);
  if (trackingUrl) lines.push(`Suivi : ${trackingUrl}`);
  lines.push(
    '',
    waveLine,
    `Sinon : Wave ${wavePaymentNumber} / Orange Money ${orangeMoneyPaymentNumber}`,
    '',
    `⚠️ Yango seulement quand c'est prêt — repère : « ${yangoLandmark} »`,
    `Itinéraire : ${mapsDirectionsUrl}`
  );
  if (loyaltyTeaser?.settings.enabled) {
    lines.push(
      '',
      computeCheckoutLoyaltyMessage({
        cartTotal: amount,
        stampCount: loyaltyTeaser.stampCount,
        settings: loyaltyTeaser.settings,
      })
    );
  }
  lines.push('', 'Merci !');

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
