import { normalizeIvorianPhone, toWhatsAppNumber } from '@/lib/phone';

export const WAVE_BASE_URL = 'https://pay.wave.com/m';

export const WAVE_COUNTRY_SEGMENT = 'c/ci';

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

export function buildWhatsAppShareLink(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/** Construit le lien Wave pour un montant donné. */
export function buildWaveLink(amount: number): string | null {
  const merchantId = process.env.NEXT_PUBLIC_WAVE_MERCHANT_ID;
  if (!merchantId) return null;
  return `${WAVE_BASE_URL}/${merchantId}/${WAVE_COUNTRY_SEGMENT}/?amount=${amount}`;
}
