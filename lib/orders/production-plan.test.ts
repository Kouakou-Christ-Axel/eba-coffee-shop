import { describe, it, expect } from 'vitest';
import { buildProductionPlan, type ProducibleOrder } from './production-plan';
import type { CartItem } from '@/lib/cart-store';
import type { OrderStatus } from '@/generated/prisma/client';

const NOW = new Date('2026-06-13T09:00:00Z');

function item(
  productId: string,
  productName: string,
  quantity: number,
  supplements: { optionName: string; quantity?: number }[] = [],
  overrides: Partial<CartItem> = {}
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
    ...overrides,
  } as CartItem;
}

function order(
  id: string,
  items: CartItem[],
  overrides: Partial<ProducibleOrder> = {}
): ProducibleOrder {
  return {
    id,
    // Périmètre par défaut : déjà en cuisine, pas encore prête — le cas
    // courant que ces tests exercent.
    status: 'PREPARING' as OrderStatus,
    pickupTime: null,
    createdAt: NOW,
    items,
    ...overrides,
  };
}

describe('buildProductionPlan', () => {
  it('regroupe par jour de RETRAIT quand il existe', () => {
    const plan = buildProductionPlan(
      [
        order('o1', [item('p1', 'Sponge cake', 2)], {
          pickupTime: new Date('2026-06-15T10:00:00Z'),
        }),
      ],
      NOW
    );
    expect(plan).toHaveLength(1);
    expect(plan[0].date).toBe('2026-06-15');
    expect(plan[0].totalItems).toBe(2);
  });

  it('retombe sur le jour de création quand il n’y a pas de créneau', () => {
    const plan = buildProductionPlan(
      [order('o1', [item('p1', 'Crêpe', 1)])],
      NOW
    );
    expect(plan[0].date).toBe('2026-06-13');
  });

  it('n’expose AUCUN jour vide et trie les jours par date croissante', () => {
    const plan = buildProductionPlan(
      [
        order('o2', [item('p1', 'Sponge cake', 1)], {
          pickupTime: new Date('2026-06-17T10:00:00Z'),
        }),
        order('o1', [item('p1', 'Sponge cake', 1)], {
          pickupTime: new Date('2026-06-15T10:00:00Z'),
        }),
      ],
      NOW
    );
    expect(plan.map((d) => d.date)).toEqual(['2026-06-15', '2026-06-17']);
  });

  it('renvoie un tableau vide quand il n’y a rien à produire', () => {
    expect(buildProductionPlan([], NOW)).toEqual([]);
  });

  it('exclut les commandes annulées, pas encore lancées ou déjà prêtes/terminées', () => {
    const plan = buildProductionPlan(
      [
        order('o1', [item('p1', 'Sponge cake', 5)], { status: 'CANCELLED' }),
        order('o2', [item('p1', 'Sponge cake', 3)], { status: 'NEW' }),
        order('o3', [item('p1', 'Sponge cake', 7)], { status: 'READY' }),
        order('o4', [item('p1', 'Sponge cake', 9)], { status: 'COMPLETED' }),
        order('o5', [item('p1', 'Sponge cake', 1)]),
      ],
      NOW
    );
    expect(plan[0].totalItems).toBe(1);
    expect(plan[0].lines[0].orderIds).toEqual(['o5']);
  });

  it('additionne les quantités du même produit à travers plusieurs commandes', () => {
    const plan = buildProductionPlan(
      [
        order('o1', [item('p1', 'Sponge cake', 2)]),
        order('o2', [item('p1', 'Sponge cake', 3)]),
      ],
      NOW
    );
    expect(plan[0].lines).toHaveLength(1);
    expect(plan[0].lines[0].quantity).toBe(5);
    expect(plan[0].lines[0].orderIds).toEqual(['o1', 'o2']);
  });

  it('ventile par goût en appliquant le multiplicateur de parts', () => {
    // 2 parts Vanille × 3 boîtes = 6 parts à produire, pas 2.
    const plan = buildProductionPlan(
      [
        order('o1', [
          item('p1', 'Boîte', 3, [
            { optionName: 'Vanille', quantity: 2 },
            { optionName: 'Coco', quantity: 1 },
          ]),
        ]),
      ],
      NOW
    );
    expect(plan[0].lines[0].flavours).toEqual([
      { groupName: 'Goûts', optionName: 'Vanille', quantity: 6 },
      { groupName: 'Goûts', optionName: 'Coco', quantity: 3 },
    ]);
  });

  it('trie les lignes et les goûts par quantité décroissante', () => {
    const plan = buildProductionPlan(
      [
        order('o1', [
          item('p1', 'Crêpe', 1),
          item('p2', 'Sponge cake', 4, [
            { optionName: 'Coco' },
            { optionName: 'Vanille', quantity: 3 },
          ]),
        ]),
      ],
      NOW
    );
    expect(plan[0].lines.map((l) => l.productName)).toEqual([
      'Sponge cake',
      'Crêpe',
    ]);
    expect(plan[0].lines[0].flavours.map((f) => f.optionName)).toEqual([
      'Vanille',
      'Coco',
    ]);
  });

  it('isole la part ajoutée à une commande APRÈS son entrée en cuisine', () => {
    const plan = buildProductionPlan(
      [
        order('o1', [
          item('p1', 'Sponge cake', 2),
          item('p1', 'Sponge cake', 1, [], { addedLater: true }),
        ]),
      ],
      NOW
    );
    expect(plan[0].lines[0].quantity).toBe(3);
    expect(plan[0].lines[0].addedLaterQuantity).toBe(1);
  });

  it('isole la part venant d’une commande programmée déjà lancée en avance', () => {
    const soon = new Date(NOW.getTime() + 20 * 60_000); // dans 20 min : pas "en avance"
    const farAhead = new Date(NOW.getTime() + 6 * 60 * 60_000); // dans 6h : "en avance"
    const plan = buildProductionPlan(
      [
        order('o1', [item('p1', 'Sponge cake', 2)], { pickupTime: soon }),
        order('o2', [item('p1', 'Sponge cake', 5)], { pickupTime: farAhead }),
      ],
      NOW
    );
    // Les deux commandes retombent sur le jour de retrait courant (même jour
    // civil que NOW) : une seule ligne, dont une partie « programmée ».
    expect(plan[0].lines[0].quantity).toBe(7);
    expect(plan[0].lines[0].scheduledQuantity).toBe(5);
  });
});
