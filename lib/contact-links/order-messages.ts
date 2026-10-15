import { getPickupCode } from '@/lib/orders/format';
import type { LoyaltySettings } from '@/lib/loyalty-settings';

/** Message "ta commande est prête" via WhatsApp. */
export function buildPickupReadyMessage(params: {
  customerName?: string | null;
  dailyNumber: number;
  reference: string;
  /** Repère à indiquer comme destination dans l'appli Yango. */
  yangoLandmark: string;
  /** URL publique de suivi (/commande/:id) à joindre au message. */
  trackingUrl?: string;
  /** Issue fidélité de CETTE commande (tampon crédité ou non, etc.). */
  loyalty?: {
    settings: LoyaltySettings;
    stampEarned: boolean;
    isFirstStampEver: boolean;
    stampCount: number;
  } | null;
}): string {
  const {
    customerName,
    dailyNumber,
    reference,
    yangoLandmark,
    trackingUrl,
    loyalty,
  } = params;
  const number = String(dailyNumber).padStart(3, '0');
  const greeting = customerName ? `Bonjour ${customerName} 👋` : 'Bonjour 👋';

  const lines = [
    greeting,
    '',
    `Ta commande #${number} est prête ✅`,
    `🔑 Code : ${getPickupCode(reference)}`,
  ];
  // Une seule ligne fidélité, et seulement si un tampon vient d'être gagné.
  if (loyalty?.settings.enabled && loyalty.stampEarned) {
    const { stampCount, settings } = loyalty;
    lines.push(
      stampCount === 0
        ? '🎁 Carte complète : grande réduction débloquée !'
        : `🎁 Tampon ${stampCount}/${settings.stampsPerCard}`
    );
  }
  lines.push('', `📍 Yango : « ${yangoLandmark} »`);
  if (trackingUrl) lines.push(`👉 Suivi : ${trackingUrl}`);
  lines.push('', 'À tout de suite ☕');
  return lines.join('\n');
}

/** Message demande de feedback post-livraison. */
export function buildFeedbackMessage(params: {
  customerName: string | null;
}): string {
  const { customerName } = params;
  const greeting = customerName ? `Bonjour ${customerName}` : 'Bonjour';
  return `${greeting}, merci pour ta commande EBA ! Comment as-tu trouvé ? ☕`;
}

export function buildTrackingShareMessage(params: {
  pickupCode: string;
  customerName: string | null;
  trackingUrl: string;
}): string {
  const { pickupCode, customerName, trackingUrl } = params;
  const who = customerName ? `la commande de ${customerName}` : 'ma commande';
  return [
    `Suivi de ${who} (EBA) : ${trackingUrl}`,
    `Code de retrait : ${pickupCode}`,
  ].join('\n');
}
