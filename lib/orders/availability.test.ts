// lib/orders/availability.test.ts
import { describe, it, expect } from 'vitest';
import type { CartItem } from '@/lib/cart-store';
import { findScheduleBlockedItem, type ScheduleMap } from './availability';

// Mercredi (getDay() === 3).
const WEDNESDAY = new Date('2026-08-05T10:00:00.000Z');
// Vendredi (getDay() === 5), même semaine.
const FRIDAY = new Date('2026-08-07T10:00:00.000Z');

function makeItem(
  productId: string,
  overrides: Partial<CartItem> = {}
): CartItem {
  return {
    cartId: `cart-${productId}`,
    productId,
    productName: `Produit ${productId}`,
    basePrice: 1000,
    coutMatiere: 0,
    coutEmballage: 0,
    quantity: 1,
    supplements: [],
    ...overrides,
  };
}

describe('findScheduleBlockedItem', () => {
  it("renvoie null quand aucun article n'a de contrainte de planning", () => {
    const items = [makeItem('capuccino')];
    const snapshot: ScheduleMap = new Map([
      ['capuccino', { availableDays: null, weeklySpecialPeriods: [] }],
    ]);
    expect(
      findScheduleBlockedItem(items, snapshot, null, WEDNESDAY)
    ).toBeNull();
  });

  it("bloque un article réservé au week-end à une date de retrait un mercredi (jour civil, pas l'heure de soumission)", () => {
    const items = [makeItem('sponge-cake')];
    const snapshot: ScheduleMap = new Map([
      [
        'sponge-cake',
        { availableDays: [0, 6], weeklySpecialPeriods: [] }, // dimanche/samedi
      ],
    ]);
    expect(
      findScheduleBlockedItem(
        items,
        snapshot,
        WEDNESDAY.toISOString(),
        WEDNESDAY
      )
    ).toBe(items[0]);
  });

  it('ne bloque pas quand la date de retrait tombe dans un jour autorisé', () => {
    const items = [makeItem('sponge-cake')];
    const snapshot: ScheduleMap = new Map([
      ['sponge-cake', { availableDays: [3, 5], weeklySpecialPeriods: [] }],
    ]);
    expect(
      findScheduleBlockedItem(items, snapshot, FRIDAY.toISOString(), WEDNESDAY)
    ).toBeNull();
  });

  it('bloque un article hors de sa fenêtre « spécialité de la semaine »', () => {
    const items = [makeItem('sponge-cake-x4')];
    const snapshot: ScheduleMap = new Map([
      [
        'sponge-cake-x4',
        {
          availableDays: null,
          weeklySpecialPeriods: [
            { startDate: '2026-08-10', endDate: '2026-08-12' },
          ],
        },
      ],
    ]);
    expect(
      findScheduleBlockedItem(
        items,
        snapshot,
        WEDNESDAY.toISOString(),
        WEDNESDAY
      )
    ).toBe(items[0]);
  });

  it('ne bloque pas quand la date de retrait tombe dans la fenêtre « spécialité »', () => {
    const items = [makeItem('sponge-cake-x4')];
    const snapshot: ScheduleMap = new Map([
      [
        'sponge-cake-x4',
        {
          availableDays: null,
          weeklySpecialPeriods: [
            { startDate: '2026-08-10', endDate: '2026-08-12' },
          ],
        },
      ],
    ]);
    const withinWindow = new Date('2026-08-11T12:00:00.000Z');
    expect(
      findScheduleBlockedItem(
        items,
        snapshot,
        withinWindow.toISOString(),
        WEDNESDAY
      )
    ).toBeNull();
  });

  it('« dès que possible » (pickupDate absent) est vérifié contre `now`', () => {
    const items = [makeItem('sponge-cake')];
    const snapshot: ScheduleMap = new Map([
      ['sponge-cake', { availableDays: [0, 6], weeklySpecialPeriods: [] }],
    ]);
    // now = mercredi (hors planning) → bloqué.
    expect(findScheduleBlockedItem(items, snapshot, null, WEDNESDAY)).toBe(
      items[0]
    );
  });

  it('un produit absent du snapshot (supprimé entre-temps) ne bloque pas', () => {
    const items = [makeItem('deleted-product')];
    const snapshot: ScheduleMap = new Map();
    expect(
      findScheduleBlockedItem(items, snapshot, null, WEDNESDAY)
    ).toBeNull();
  });

  it('renvoie le PREMIER article bloqué quand plusieurs le sont', () => {
    const items = [makeItem('capuccino'), makeItem('sponge-cake')];
    const snapshot: ScheduleMap = new Map([
      ['capuccino', { availableDays: null, weeklySpecialPeriods: [] }],
      ['sponge-cake', { availableDays: [0, 6], weeklySpecialPeriods: [] }],
    ]);
    expect(findScheduleBlockedItem(items, snapshot, null, WEDNESDAY)).toBe(
      items[1]
    );
  });
});
