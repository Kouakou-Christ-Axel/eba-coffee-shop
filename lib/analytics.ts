'use client';

// lib/analytics.ts
//
// Point d'entrée UNIQUE de la mesure d'audience. Aucun composant n'appelle
// `sendGTMEvent` directement — même principe que lib/contact-links.ts pour les
// URLs externes : une seule implémentation, un seul endroit à corriger.
//
// Les événements suivent la nomenclature e-commerce standard GA4
// (https://developers.google.com/analytics/devguides/collection/ga4/ecommerce),
// pour que les rapports « Monétisation » de GA4 fonctionnent sans mapping
// maison. Les tags GA4 correspondants se créent dans l'interface de GTM.
//
// Rien n'est envoyé si NEXT_PUBLIC_GTM_ID est absent : en local et en preview,
// tous les helpers sont des no-op silencieux.
//
// Le consentement N'EST PAS revérifié ici : les événements sont poussés dans le
// `dataLayer`, et c'est Google Consent Mode v2 qui décide si les balises ont le
// droit de les transmettre (cf. components/analytics/consent-boot.tsx). Un
// événement poussé avant acceptation reste donc local à la page.

import { sendGTMEvent } from '@next/third-parties/google';
import type { CartItem } from '@/lib/cart-store';
import { getItemNet } from '@/lib/orders/totals';
import { formatSupplementLabel } from '@/lib/orders/format';

declare global {
  interface Window {
    /** Shim posé par components/analytics/consent-boot.tsx. */
    gtag?: (...args: unknown[]) => void;
  }
}

/** Franc CFA (UEMOA), code ISO 4217. Les montants sont des entiers. */
export const ANALYTICS_CURRENCY = 'XOF';

/** Item e-commerce GA4. `price` est le prix NET UNITAIRE, en FCFA entier. */
export type AnalyticsItem = {
  item_id: string;
  item_name: string;
  item_category?: string;
  /** Suppléments choisis, concaténés — distingue « Latte » de « Latte + sirop ». */
  item_variant?: string;
  price: number;
  quantity: number;
};

/** Canaux de contact suivis comme conversions. */
export type ContactChannel = 'whatsapp' | 'phone' | 'maps';

function isEnabled(): boolean {
  return (
    typeof window !== 'undefined' && Boolean(process.env.NEXT_PUBLIC_GTM_ID)
  );
}

/** Valeur totale d'un lot d'items (prix unitaire × quantité). */
function sumValue(items: AnalyticsItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

/**
 * Pousse un événement e-commerce.
 *
 * Le `{ ecommerce: null }` préalable est EXIGÉ par GA4 : sans lui, GTM fusionne
 * l'objet `ecommerce` du push précédent avec le nouveau, et les items d'un
 * `add_to_cart` se retrouvent recollés au `purchase` suivant.
 */
function pushEcommerce(
  event: string,
  ecommerce: Record<string, unknown>
): void {
  if (!isEnabled()) return;
  sendGTMEvent({ ecommerce: null });
  sendGTMEvent({
    event,
    ecommerce: { currency: ANALYTICS_CURRENCY, ...ecommerce },
  });
}

/**
 * Convertit une ligne de panier en item GA4. Le prix net de la ligne
 * (`getItemNet`, remises comprises) est ramené à l'unité — GA4 attend un prix
 * unitaire et une quantité séparés.
 */
export function cartItemToAnalyticsItem(item: CartItem): AnalyticsItem {
  const quantity = Math.max(1, item.quantity);
  return {
    item_id: item.productId,
    item_name: item.productName,
    ...(item.supplements.length > 0
      ? { item_variant: item.supplements.map(formatSupplementLabel).join(', ') }
      : {}),
    price: Math.round(getItemNet(item) / quantity),
    quantity,
  };
}

/** Consultation d'un produit (ouverture de la fiche / modale d'options). */
export function trackViewItem(item: AnalyticsItem): void {
  pushEcommerce('view_item', { value: item.price, items: [item] });
}

/** Ajout au panier — un seul événement par geste, quelle que soit la quantité. */
export function trackAddToCart(items: AnalyticsItem[]): void {
  if (items.length === 0) return;
  pushEcommerce('add_to_cart', { value: sumValue(items), items });
}

/** Retrait d'une ligne du panier (bouton corbeille ou décrément jusqu'à 0). */
export function trackRemoveFromCart(items: AnalyticsItem[]): void {
  if (items.length === 0) return;
  pushEcommerce('remove_from_cart', { value: sumValue(items), items });
}

/** Départ vers le formulaire de commande (« Passer la commande »). */
export function trackBeginCheckout(items: AnalyticsItem[]): void {
  if (items.length === 0) return;
  pushEcommerce('begin_checkout', { value: sumValue(items), items });
}

/**
 * Commande créée. `value` est le montant RÉELLEMENT DÛ (récompense fidélité
 * déjà déduite), pas la somme brute des articles.
 */
export function trackPurchase(params: {
  transactionId: string;
  value: number;
  items: AnalyticsItem[];
}): void {
  pushEcommerce('purchase', {
    transaction_id: params.transactionId,
    value: params.value,
    items: params.items,
  });
}

/**
 * Clic sur un canal de contact (conversion « hors tunnel »).
 * `location` identifie l'emplacement du lien, ex. 'contact-hero', 'footer'.
 */
export function trackContactClick(
  channel: ContactChannel,
  location: string
): void {
  if (!isEnabled()) return;
  sendGTMEvent({ event: 'contact_click', contact_channel: channel, location });
}

/**
 * Répercute le choix du visiteur sur Google Consent Mode v2.
 *
 * Passe par `window.gtag` — le shim posé par `consent-boot.tsx` — et non par
 * `sendGTMEvent` : une commande de consentement s'empile dans le `dataLayer`
 * sous forme d'`arguments` positionnels (`['consent', 'update', {…}]`), pas
 * d'un objet nommé. Sans effet si l'amorçage n'a pas eu lieu (GTM non
 * configuré) : le no-op est alors le comportement correct.
 */
export function updateConsent(accepted: boolean): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function')
    return;
  const value = accepted ? 'granted' : 'denied';
  window.gtag('consent', 'update', {
    ad_storage: value,
    ad_user_data: value,
    ad_personalization: value,
    analytics_storage: value,
  });
  window.gtag('set', 'ads_data_redaction', !accepted);
}
