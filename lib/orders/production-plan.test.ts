import { describe, it, expect } from 'vitest';
import { buildProductionPlan, type ProducibleOrder } from './production-plan';
import type { CartItem } from '@/lib/cart-store';
import type { OrderStatus } from '@/generated/prisma/client';

function item(
  productId: string,
  productName: string,
  quantity: number,
  supplements: { optionName: string; quantity?: number }[] = []
): CartItem {
  return {
    cartId: `${productId}-${quantity}`,
    productId,
    productName,
    basePrice: 1000,
    coutMatiere: 0,
    coutEmballage: 0,
    quantity,
    supplements: supplements.map((s) => ({
      groupName: 'Goûts',
      optionName: s.optionName,
      price: 0,
      quantity: s.quantity,
    })),
    discount: 0,
    discountReason: null,
  } as CartItem;
}

function order(
  id: string,
  items: CartItem[],
  overrides: Partial<ProducibleOrder> = {}
): ProducibleOrder {
  return {
    id,
    status: 'NEW' as OrderStatus,
    pickupTime: null,
    createdAt: new Date('2026-06-13T09:00:00Z'),
    stockReservedAt: null,
    items,
    ...overrides,
  };
}

describe('buildProductionPlan', () => {
  it('regroupe par jour de RETRAIT quand il existe', () => {
    const plan = buildProductionPlan([
      order('o1', [item('p1', 'Sponge cake', 2)], {
        pickupTime: new Date('2026-06-15T10:00:00Z'),
      }),
    ]);
    expect(plan).toHaveLength(1);
    expect(plan[0].date).toBe('2026-06-15');
    expect(plan[0].totalItems).toBe(2);
  });

  it('retombe sur le jour de création quand il n’y a pas de créneau', () => {
    const plan = buildProductionPlan([order('o1', [item('p1', 'Crêpe', 1)])]);
    expect(plan[0].date).toBe('2026-06-13');
  });

  it('n’expose AUCUN jour vide et trie les jours par date croissante', () => {
    const plan = buildProductionPlan([
      order('o2', [item('p1', 'Sponge cake', 1)], {
        pickupTime: new Date('2026-06-17T10:00:00Z'),
      }),
      order('o1', [item('p1', 'Sponge cake', 1)], {
        pickupTime: new Date('2026-06-15T10:00:00Z'),
      }),
    ]);
    expect(plan.map((d) => d.date)).toEqual(['2026-06-15', '2026-06-17']);
  });

  it('renvoie un tableau vide quand il n’y a rien à produire', () => {
    expect(buildProductionPlan([])).toEqual([]);
  });

  it('exclut les commandes annulées et celles dont le stock est déjà réservé', () => {
    const plan = buildProductionPlan([
      order('o1', [item('p1', 'Sponge cake', 5)], { status: 'CANCELLED' }),
      order('o2', [item('p1', 'Sponge cake', 3)], {
        stockReservedAt: new Date(),
      }),
      order('o3', [item('p1', 'Sponge cake', 1)]),
    ]);
    expect(plan[0].totalItems).toBe(1);
    expect(plan[0].lines[0].orderIds).toEqual(['o3']);
  });

  it('additionne les quantités du même produit à travers plusieurs commandes', () => {
    const plan = buildProductionPlan([
      order('o1', [item('p1', 'Sponge cake', 2)]),
      order('o2', [item('p1', 'Sponge cake', 3)]),
    ]);
    expect(plan[0].lines).toHaveLength(1);
    expect(plan[0].lines[0].quantity).toBe(5);
    expect(plan[0].lines[0].orderIds).toEqual(['o1', 'o2']);
  });

  it('ventile par goût en appliquant le multiplicateur de parts', () => {
    // 2 parts Vanille × 3 boîtes = 6 parts à produire, pas 2.
    const plan = buildProductionPlan([
      order('o1', [
        item('p1', 'Boîte', 3, [
          { optionName: 'Vanille', quantity: 2 },
          { optionName: 'Coco', quantity: 1 },
        ]),
      ]),
    ]);
    expect(plan[0].lines[0].flavours).toEqual([
      { groupName: 'Goûts', optionName: 'Vanille', quantity: 6 },
      { groupName: 'Goûts', optionName: 'Coco', quantity: 3 },
    ]);
  });

  it('trie les lignes et les goûts par quantité décroissante', () => {
    const plan = buildProductionPlan([
      order('o1', [
        item('p1', 'Crêpe', 1),
        item('p2', 'Sponge cake', 4, [
          { optionName: 'Coco' },
          { optionName: 'Vanille', quantity: 3 },
        ]),
      ]),
    ]);
    expect(plan[0].lines.map((l) => l.productName)).toEqual([
      'Sponge cake',
      'Crêpe',
    ]);
    expect(plan[0].lines[0].flavours.map((f) => f.optionName)).toEqual([
      'Vanille',
      'Coco',
    ]);
  });
});
