import { getPickupCode } from '@/lib/orders/format';
import {
  computePickupMessage,
  PICKUP_GENERIC_MESSAGE,
} from '@/lib/loyalty-messaging';
import type { LoyaltySettings } from '@/lib/loyalty-settings';

/** Message "ta commande est prête" via WhatsApp. */
export function buildPickupReadyMessage(params: {
  dailyNumber: number;
  reference: string;
  /** Repère à indiquer comme destination dans l'appli Yango. */
  yangoLandmark: string;
  /** Lien Google Maps (itinéraire) à joindre pour estimer la course. */
  mapsDirectionsUrl: string;
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
    dailyNumber,
    reference,
    yangoLandmark,
    mapsDirectionsUrl,
    trackingUrl,
    loyalty,
  } = params;
  const number = String(dailyNumber).padStart(3, '0');
  const confirmation =
    loyalty && loyalty.settings.enabled
      ? computePickupMessage(loyalty)
      : PICKUP_GENERIC_MESSAGE;

  const lines = [
    confirmation,
    '',
    `Commande EBA #${number} · Code : ${getPickupCode(reference)}`,
    `Viens, ou Yango (repère : « ${yangoLandmark} ») : ${mapsDirectionsUrl}`,
  ];
  if (trackingUrl) lines.push(`Suivi : ${trackingUrl}`);
  lines.push('À tout de suite !');
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
