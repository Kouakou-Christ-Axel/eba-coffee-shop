// lib/schemas/order.test.ts
import { describe, it, expect } from 'vitest';
import {
  setOrderCustomerSchema,
  updateOrderDetailsSchema,
  updateOrderFulfillmentSchema,
  orderPaymentLineSchema,
  orderPaymentsSchema,
} from './order';

describe('setOrderCustomerSchema', () => {
  it('accepte une liaison à un client existant (customerId)', () => {
    const r = setOrderCustomerSchema.safeParse({ customerId: 'cus_123' });
    expect(r.success).toBe(true);
  });

  it('accepte un détachement explicite (customerId: null)', () => {
    const r = setOrderCustomerSchema.safeParse({ customerId: null });
    expect(r.success).toBe(true);
  });

  it('accepte une liaison par téléphone (+ nom optionnel)', () => {
    expect(
      setOrderCustomerSchema.safeParse({ phone: '0788123456' }).success
    ).toBe(true);
    expect(
      setOrderCustomerSchema.safeParse({ phone: '0788123456', name: 'Awa' })
        .success
    ).toBe(true);
  });

  it('rejette un corps vide (ni customerId ni phone)', () => {
    expect(setOrderCustomerSchema.safeParse({}).success).toBe(false);
    expect(setOrderCustomerSchema.safeParse({ name: 'Awa' }).success).toBe(
      false
    );
  });

  it('rejette un téléphone vide', () => {
    expect(setOrderCustomerSchema.safeParse({ phone: '' }).success).toBe(false);
  });

  it('rejette un customerId vide (chaîne)', () => {
    expect(setOrderCustomerSchema.safeParse({ customerId: '' }).success).toBe(
      false
    );
  });
});

describe('updateOrderDetailsSchema', () => {
  it('accepte une mise à jour partielle (un seul champ)', () => {
    expect(
      updateOrderDetailsSchema.safeParse({ orderType: 'DELIVERY' }).success
    ).toBe(true);
    expect(
      updateOrderDetailsSchema.safeParse({ note: 'Sans sucre' }).success
    ).toBe(true);
    expect(
      updateOrderDetailsSchema.safeParse({ paymentMode: 'WAVE' }).success
    ).toBe(true);
  });

  it('accepte un créneau de retrait ISO ou null', () => {
    expect(
      updateOrderDetailsSchema.safeParse({
        pickupTime: '2026-06-23T14:30:00.000Z',
      }).success
    ).toBe(true);
    expect(
      updateOrderDetailsSchema.safeParse({ pickupTime: null }).success
    ).toBe(true);
  });

  it('accepte de retirer le mode de paiement / la note (null)', () => {
    expect(
      updateOrderDetailsSchema.safeParse({ paymentMode: null }).success
    ).toBe(true);
    expect(updateOrderDetailsSchema.safeParse({ note: null }).success).toBe(
      true
    );
  });

  it('rejette un corps vide (aucun champ)', () => {
    expect(updateOrderDetailsSchema.safeParse({}).success).toBe(false);
  });

  it('rejette une valeur d’énumération invalide', () => {
    expect(
      updateOrderDetailsSchema.safeParse({ orderType: 'INVALID' }).success
    ).toBe(false);
    expect(
      updateOrderDetailsSchema.safeParse({ paymentMode: 'BITCOIN' }).success
    ).toBe(false);
  });

  it('rejette un créneau de retrait non ISO', () => {
    expect(
      updateOrderDetailsSchema.safeParse({ pickupTime: '2026-06-23 14:30' })
        .success
    ).toBe(false);
  });

  it('rejette une note trop longue (> 500)', () => {
    expect(
      updateOrderDetailsSchema.safeParse({ note: 'x'.repeat(501) }).success
    ).toBe(false);
  });
});

describe('updateOrderFulfillmentSchema', () => {
  it('accepte une mise à jour partielle (un seul champ)', () => {
    expect(
      updateOrderFulfillmentSchema.safeParse({ orderType: 'DELIVERY' }).success
    ).toBe(true);
    expect(
      updateOrderFulfillmentSchema.safeParse({ pickupTime: null }).success
    ).toBe(true);
    expect(
      updateOrderFulfillmentSchema.safeParse({ note: 'Sans sucre' }).success
    ).toBe(true);
  });

  it('accepte le livreur : les deux champs fournis (renseignés ou effacés)', () => {
    expect(
      updateOrderFulfillmentSchema.safeParse({
        driverName: 'Ibrahim',
        driverPhone: '0788123456',
      }).success
    ).toBe(true);
    expect(
      updateOrderFulfillmentSchema.safeParse({
        driverName: null,
        driverPhone: null,
      }).success
    ).toBe(true);
  });

  it('rejette le livreur si un seul des deux champs est fourni', () => {
    expect(
      updateOrderFulfillmentSchema.safeParse({ driverName: 'Ibrahim' }).success
    ).toBe(false);
    expect(
      updateOrderFulfillmentSchema.safeParse({ driverPhone: '0788123456' })
        .success
    ).toBe(false);
  });

  it('rejette le livreur si un seul des deux champs est null', () => {
    expect(
      updateOrderFulfillmentSchema.safeParse({
        driverName: 'Ibrahim',
        driverPhone: null,
      }).success
    ).toBe(false);
  });

  it('ne touche jamais paymentMode : accepté seulement absent du schéma', () => {
    // paymentMode n'existe pas sur ce schéma (champ inconnu ignoré par Zod).
    const r = updateOrderFulfillmentSchema.safeParse({
      orderType: 'DELIVERY',
      paymentMode: 'CASH',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).not.toHaveProperty('paymentMode');
    }
  });

  it('rejette un corps vide (aucun champ)', () => {
    expect(updateOrderFulfillmentSchema.safeParse({}).success).toBe(false);
  });
});

describe('orderPaymentLineSchema / orderPaymentsSchema', () => {
  it('accepte une ligne valide', () => {
    expect(
      orderPaymentLineSchema.safeParse({ mode: 'CASH', amount: 1000 }).success
    ).toBe(true);
  });

  it('rejette un montant nul, négatif ou non entier', () => {
    expect(
      orderPaymentLineSchema.safeParse({ mode: 'CASH', amount: 0 }).success
    ).toBe(false);
    expect(
      orderPaymentLineSchema.safeParse({ mode: 'CASH', amount: -100 }).success
    ).toBe(false);
    expect(
      orderPaymentLineSchema.safeParse({ mode: 'CASH', amount: 100.5 }).success
    ).toBe(false);
  });

  it('rejette un mode invalide', () => {
    expect(
      orderPaymentLineSchema.safeParse({ mode: 'BITCOIN', amount: 1000 })
        .success
    ).toBe(false);
  });

  it('accepte un tableau d’une ou plusieurs lignes', () => {
    expect(
      orderPaymentsSchema.safeParse([{ mode: 'CASH', amount: 1000 }]).success
    ).toBe(true);
    expect(
      orderPaymentsSchema.safeParse([
        { mode: 'CASH', amount: 7000 },
        { mode: 'ORANGE_MONEY', amount: 3000 },
      ]).success
    ).toBe(true);
  });

  it('rejette un tableau vide', () => {
    expect(orderPaymentsSchema.safeParse([]).success).toBe(false);
  });
});
