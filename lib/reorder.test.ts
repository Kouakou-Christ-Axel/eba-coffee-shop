// lib/reorder.test.ts
//
// Re-commande d'une commande passée. Le risque est double : ressortir un prix
// périmé (on facture faux), ou reconstruire une ligne dont la cuisine ne peut
// rien faire (option supprimée entre-temps).

import { describe, it, expect } from 'vitest';
import type { CartItem } from '@/lib/cart-store';
import type { MenuCategory, Product } from '@/config/menu';
import { buildReorderPlan, formatReorderOutcomeLabel } from './reorder';

function product(id: string, extra: Partial<Product> = {}): Product {
  return {
    id,
    name: id,
    description: `Description ${id}`,
    price: 2000,
    ...extra,
  };
}

function menuOf(products: Product[]): MenuCategory[] {
  return [{ id: 'cat', name: 'Catégorie', products }];
}

function orderItem(productId: string, extra: Partial<CartItem> = {}): CartItem {
  return {
    cartId: `line-${productId}`,
    productId,
    productName: productId,
    basePrice: 1000,
    coutMatiere: 0,
    coutEmballage: 0,
    quantity: 1,
    supplements: [],
    ...extra,
  };
}

describe('buildReorderPlan', () => {
  it('écarte un produit retiré de la carte', () => {
    const plan = buildReorderPlan(
      [orderItem('disparu', { productName: 'Chou x2' })],
      menuOf([product('autre')])
    );

    expect(plan.addable).toHaveLength(0);
    expect(plan.skipped).toEqual([{ name: 'Chou x2', reason: 'introuvable' }]);
  });

  it('écarte un produit épuisé', () => {
    const plan = buildReorderPlan(
      [orderItem('chou')],
      menuOf([product('chou', { soldOut: true })])
    );

    expect(plan.addable).toHaveLength(0);
    expect(plan.skipped).toEqual([{ name: 'chou', reason: 'indisponible' }]);
  });

  it('re-tarife depuis le menu, pas depuis la commande', () => {
    const plan = buildReorderPlan(
      [orderItem('chou', { basePrice: 1000, coutMatiere: 111 })],
      menuOf([product('chou', { price: 2500, coutMatiere: 300 })])
    );

    expect(plan.addable[0].item.basePrice).toBe(2500);
    expect(plan.addable[0].item.coutMatiere).toBe(300);
  });

  it('reprend le nom courant du produit, pas celui de la commande', () => {
    const plan = buildReorderPlan(
      [orderItem('chou', { productName: 'Ancien nom' })],
      menuOf([product('chou', { name: 'Chou x2' })])
    );

    expect(plan.addable[0].item.productName).toBe('Chou x2');
  });

  it('retire une option de supplément qui n’existe plus', () => {
    const plan = buildReorderPlan(
      [
        orderItem('chou', {
          supplements: [
            { groupName: 'Goût', optionName: 'Bissap', price: 0 },
            { groupName: 'Goût', optionName: 'Café', price: 0 },
          ],
        }),
      ],
      menuOf([
        product('chou', {
          supplements: [
            {
              name: 'Goût',
              type: 'single',
              required: true,
              options: [{ name: 'Café', price: 250 }],
            },
          ],
        }),
      ])
    );

    expect(plan.addable[0].item.supplements).toEqual([
      { groupName: 'Goût', optionName: 'Café', price: 250 },
    ]);
  });

  it('retire une option devenue épuisée', () => {
    const plan = buildReorderPlan(
      [
        orderItem('chou', {
          supplements: [{ groupName: 'Goût', optionName: 'Café', price: 0 }],
        }),
      ],
      menuOf([
        product('chou', {
          supplements: [
            {
              name: 'Goût',
              type: 'single',
              required: true,
              options: [{ name: 'Café', price: 250, soldOut: true }],
            },
          ],
        }),
      ])
    );

    expect(plan.addable[0].item.supplements).toEqual([]);
  });

  it('préserve la quantité par option des groupes à parts', () => {
    const plan = buildReorderPlan(
      [
        orderItem('boite', {
          supplements: [
            { groupName: 'Parts', optionName: 'Oreo', price: 0, quantity: 3 },
          ],
        }),
      ],
      menuOf([
        product('boite', {
          supplements: [
            {
              name: 'Parts',
              type: 'quantity',
              required: true,
              minSelect: 4,
              maxSelect: 4,
              options: [{ name: 'Oreo', price: 100 }],
            },
          ],
        }),
      ])
    );

    expect(plan.addable[0].item.supplements[0]).toEqual({
      groupName: 'Parts',
      optionName: 'Oreo',
      price: 100,
      quantity: 3,
    });
  });

  it('reporte la quantité commandée et le stock restant', () => {
    const plan = buildReorderPlan(
      [orderItem('chou', { quantity: 3 })],
      menuOf([product('chou', { remaining: 5 })])
    );

    expect(plan.addable[0].quantity).toBe(3);
    expect(plan.addable[0].maxQuantity).toBe(5);
  });

  it('traite un stock illimité comme absence de plafond', () => {
    const plan = buildReorderPlan(
      [orderItem('chou')],
      menuOf([product('chou')])
    );
    expect(plan.addable[0].maxQuantity).toBeNull();
  });

  it('ajoute ce qui reste commandable et signale le reste', () => {
    const plan = buildReorderPlan(
      [orderItem('chou'), orderItem('eclair'), orderItem('fantome')],
      menuOf([product('chou'), product('eclair', { soldOut: true })])
    );

    expect(plan.addable.map((l) => l.item.productId)).toEqual(['chou']);
    expect(plan.skipped).toHaveLength(2);
  });
});

describe('formatReorderOutcomeLabel', () => {
  it('accorde le pluriel sur le nombre d’articles, quantités comprises', () => {
    const plan = buildReorderPlan(
      [orderItem('chou', { quantity: 2 })],
      menuOf([product('chou')])
    );
    expect(formatReorderOutcomeLabel(plan)).toBe('2 articles ajoutés');
  });

  it('reste au singulier pour un seul article', () => {
    const plan = buildReorderPlan(
      [orderItem('chou')],
      menuOf([product('chou')])
    );
    expect(formatReorderOutcomeLabel(plan)).toBe('1 article ajouté');
  });

  it('signale les articles écartés', () => {
    const plan = buildReorderPlan(
      [orderItem('chou'), orderItem('eclair')],
      menuOf([product('chou'), product('eclair', { soldOut: true })])
    );
    expect(formatReorderOutcomeLabel(plan)).toBe(
      "1 article ajouté · 1 indisponible aujourd'hui"
    );
  });

  it('le dit quand rien n’a pu être ajouté', () => {
    const plan = buildReorderPlan(
      [orderItem('chou')],
      menuOf([product('chou', { soldOut: true })])
    );
    expect(formatReorderOutcomeLabel(plan)).toBe(
      "Aucun article ajouté · 1 indisponible aujourd'hui"
    );
  });
});
