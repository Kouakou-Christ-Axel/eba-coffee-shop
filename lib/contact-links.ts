// lib/contact-links.ts
//
// Helpers pour générer les liens de contact externes (tel:, wa.me).
// Pas d'intégration API tierce — uniquement de la construction d'URL.
//
// Le numéro WhatsApp doit être au format E.164 sans le `+` (cf. wa.me).
// Voir lib/phone.ts pour la normalisation.

import { normalizeIvorianPhone, toWhatsAppNumber } from '@/lib/phone';

const priceFormatter = new Intl.NumberFormat('fr-FR');

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
 * Message Wave envoyé via WhatsApp. Format de base à ajuster avec le client
 * (le lien Wave réel — `pay.wave.com/m/...` — doit être ajouté manuellement
 * par le caissier ou injecté via NEXT_PUBLIC_WAVE_LINK).
 */
export function buildWaveRequestMessage(params: {
  customerName: string | null;
  dailyNumber: number;
  amount: number;
}): string {
  const { customerName, dailyNumber, amount } = params;
  const greeting = customerName ? `Bonjour ${customerName}` : 'Bonjour';
  const number = String(dailyNumber).padStart(3, '0');
  const waveLink = process.env.NEXT_PUBLIC_WAVE_LINK;
  const linkLine = waveLink ? `\n${waveLink}` : '\n[lien Wave à compléter]';
  return `${greeting}, voici le lien Wave pour régler ta commande EBA #${number} (${priceFormatter.format(amount)} F) :${linkLine}\n\nMerci !`;
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
