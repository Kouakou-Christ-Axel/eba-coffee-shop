// lib/schemas/order.test.ts
import { describe, it, expect } from 'vitest';
import { setOrderCustomerSchema } from './order';

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
