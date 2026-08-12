// lib/analytics.test.ts
//
// Charge utile des événements GA4. Deux invariants qui cassent silencieusement
// les rapports s'ils régressent :
//   1. le `{ ecommerce: null }` de purge AVANT chaque événement e-commerce
//      (sans lui, GTM recolle les items du push précédent) ;
//   2. le prix RAMENÉ À L'UNITÉ (GA4 attend prix unitaire + quantité, alors que
//      getItemNet renvoie le net de la ligne entière).
// Plus le no-op total quand NEXT_PUBLIC_GTM_ID est absent.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CartItem } from '@/lib/cart-store';

const sendGTMEvent = vi.fn();
vi.mock('@next/third-parties/google', () => ({
  sendGTMEvent: (...args: unknown[]) => sendGTMEvent(...args),
}));

function makeItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    cartId: 'c1',
    productId: 'p1',
    productName: 'Latte',
    basePrice: 2000,
    coutMatiere: 0,
    coutEmballage: 0,
    quantity: 1,
    supplements: [],
    ...overrides,
  };
}

/** Recharge le module avec un NEXT_PUBLIC_GTM_ID donné (lu à l'appel). */
async function loadAnalytics(gtmId: string | undefined) {
  vi.resetModules();
  if (gtmId === undefined) delete process.env.NEXT_PUBLIC_GTM_ID;
  else process.env.NEXT_PUBLIC_GTM_ID = gtmId;
  return import('./analytics');
}

describe('analytics', () => {
  beforeEach(() => {
    sendGTMEvent.mockClear();
    // `isEnabled()` exige un `window` : environnement node, on le simule.
    (globalThis as Record<string, unknown>).window = {};
  });

  describe('cartItemToAnalyticsItem', () => {
    it('ramène le prix de la ligne à un prix unitaire', async () => {
      const { cartItemToAnalyticsItem } = await loadAnalytics('GTM-TEST');
      // 3 × 2000 = 6000 pour la ligne → 2000 l'unité.
      expect(cartItemToAnalyticsItem(makeItem({ quantity: 3 }))).toEqual({
        item_id: 'p1',
        item_name: 'Latte',
        price: 2000,
        quantity: 3,
      });
    });

    it('intègre le prix des suppléments et les nomme dans item_variant', async () => {
      const { cartItemToAnalyticsItem } = await loadAnalytics('GTM-TEST');
      const item = makeItem({
        quantity: 2,
        supplements: [
          { groupName: 'Sirop', optionName: 'Vanille', price: 300 },
          { groupName: 'Extra', optionName: 'Shot', price: 500, quantity: 2 },
        ],
      });
      // (2000 + 300 + 500×2) = 3300 l'unité.
      expect(cartItemToAnalyticsItem(item)).toMatchObject({
        price: 3300,
        quantity: 2,
        item_variant: 'Vanille, Shot ×2',
      });
    });

    it('déduit la remise de ligne du prix unitaire', async () => {
      const { cartItemToAnalyticsItem } = await loadAnalytics('GTM-TEST');
      // Ligne 2 × 2000 = 4000, remise 400 → net 3600 → 1800 l'unité.
      const item = makeItem({ quantity: 2, discount: 400 });
      expect(cartItemToAnalyticsItem(item).price).toBe(1800);
    });

    it('omet item_variant sans supplément', async () => {
      const { cartItemToAnalyticsItem } = await loadAnalytics('GTM-TEST');
      expect(cartItemToAnalyticsItem(makeItem())).not.toHaveProperty(
        'item_variant'
      );
    });
  });

  describe('événements e-commerce', () => {
    it('purge `ecommerce` avant chaque événement', async () => {
      const { trackAddToCart } = await loadAnalytics('GTM-TEST');
      trackAddToCart([
        { item_id: 'p1', item_name: 'Latte', price: 2000, quantity: 1 },
      ]);
      expect(sendGTMEvent).toHaveBeenCalledTimes(2);
      expect(sendGTMEvent).toHaveBeenNthCalledWith(1, { ecommerce: null });
    });

    it('calcule `value` = prix unitaire × quantité, en XOF', async () => {
      const { trackAddToCart } = await loadAnalytics('GTM-TEST');
      trackAddToCart([
        { item_id: 'p1', item_name: 'Latte', price: 2000, quantity: 3 },
        { item_id: 'p2', item_name: 'Cookie', price: 1000, quantity: 2 },
      ]);
      expect(sendGTMEvent).toHaveBeenNthCalledWith(2, {
        event: 'add_to_cart',
        ecommerce: expect.objectContaining({ currency: 'XOF', value: 8000 }),
      });
    });

    it('reprend le montant dû tel quel pour purchase (récompense déduite)', async () => {
      const { trackPurchase } = await loadAnalytics('GTM-TEST');
      trackPurchase({
        transactionId: 'EBA-20260811-AB12',
        // Volontairement < somme des items : la récompense fidélité a été
        // déduite côté serveur, GA4 doit voir le montant réellement encaissé.
        value: 4000,
        items: [
          { item_id: 'p1', item_name: 'Latte', price: 2000, quantity: 3 },
        ],
      });
      expect(sendGTMEvent).toHaveBeenNthCalledWith(2, {
        event: 'purchase',
        ecommerce: {
          currency: 'XOF',
          transaction_id: 'EBA-20260811-AB12',
          value: 4000,
          items: [
            { item_id: 'p1', item_name: 'Latte', price: 2000, quantity: 3 },
          ],
        },
      });
    });

    it('ne pousse rien pour un lot vide', async () => {
      const { trackAddToCart, trackBeginCheckout, trackRemoveFromCart } =
        await loadAnalytics('GTM-TEST');
      trackAddToCart([]);
      trackBeginCheckout([]);
      trackRemoveFromCart([]);
      expect(sendGTMEvent).not.toHaveBeenCalled();
    });
  });

  describe('contact_click', () => {
    it('émet le canal et son emplacement', async () => {
      const { trackContactClick } = await loadAnalytics('GTM-TEST');
      trackContactClick('whatsapp', 'footer');
      expect(sendGTMEvent).toHaveBeenCalledWith({
        event: 'contact_click',
        contact_channel: 'whatsapp',
        location: 'footer',
      });
    });
  });

  describe('sans NEXT_PUBLIC_GTM_ID', () => {
    it('rend tous les helpers inertes', async () => {
      const {
        trackAddToCart,
        trackPurchase,
        trackContactClick,
        trackViewItem,
      } = await loadAnalytics(undefined);
      const items = [
        { item_id: 'p1', item_name: 'Latte', price: 2000, quantity: 1 },
      ];
      trackViewItem(items[0]);
      trackAddToCart(items);
      trackPurchase({ transactionId: 'X', value: 2000, items });
      trackContactClick('phone', 'footer');
      expect(sendGTMEvent).not.toHaveBeenCalled();
    });
  });
});
