// lib/schemas/customer.test.ts
import { describe, it, expect } from 'vitest';
import {
  customerInputSchema,
  customerUpdateSchema,
} from '@/lib/schemas/customer';

describe('customerInputSchema', () => {
  it('accepte un client avec téléphone (nom optionnel)', () => {
    const parsed = customerInputSchema.parse({ phone: '0788123456' });
    expect(parsed.phone).toBe('0788123456');
    expect(parsed.name).toBeUndefined();
  });

  it('trim le nom et le téléphone', () => {
    const parsed = customerInputSchema.parse({
      name: '  Awa  ',
      phone: '  0788123456  ',
    });
    expect(parsed.name).toBe('Awa');
    expect(parsed.phone).toBe('0788123456');
  });

  it('rejette un téléphone vide', () => {
    expect(customerInputSchema.safeParse({ phone: '' }).success).toBe(false);
    expect(customerInputSchema.safeParse({ name: 'Awa' }).success).toBe(false);
  });
});

describe('customerUpdateSchema', () => {
  it('accepte une mise à jour du seul nom', () => {
    expect(customerUpdateSchema.safeParse({ name: 'Awa' }).success).toBe(true);
  });

  it('accepte la mise à null du nom', () => {
    const parsed = customerUpdateSchema.parse({ name: null });
    expect(parsed.name).toBeNull();
  });

  it('rejette un objet vide (au moins un champ requis)', () => {
    expect(customerUpdateSchema.safeParse({}).success).toBe(false);
  });
});
