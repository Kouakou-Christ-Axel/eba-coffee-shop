// lib/schemas/menu.test.ts
import { describe, it, expect } from 'vitest';
import { supplementGroupSchema } from './menu';

const baseGroup = {
  name: 'Choisissez vos goûts',
  type: 'single' as const,
  required: true,
  available: true,
  minSelect: null,
  maxSelect: null,
};

describe('supplementGroupSchema', () => {
  it('accepte des options aux noms distincts', () => {
    expect(
      supplementGroupSchema.safeParse({
        ...baseGroup,
        options: [
          { name: 'Chocolat', price: 0, available: true },
          { name: 'Vanille', price: 0, available: true },
        ],
      }).success
    ).toBe(true);
  });

  // Une option désactivée conservée sous le même nom qu'une option active a
  // déjà rendu le décrément de stock ambigu au paiement (résolution par nom,
  // pas par id) et bloqué des paiements pourtant honorables — cf.
  // lib/order-mutations.ts `decrementStockForOrderItems`.
  it('rejette deux options du même nom, même si l’une est désactivée', () => {
    const result = supplementGroupSchema.safeParse({
      ...baseGroup,
      options: [
        { name: 'Cacahuète vanille', price: 0, available: false },
        { name: 'Cacahuète vanille', price: 0, available: true },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('la comparaison ignore la casse et les espaces superflus', () => {
    const result = supplementGroupSchema.safeParse({
      ...baseGroup,
      options: [
        { name: ' Vanille', price: 0, available: true },
        { name: 'vanille ', price: 0, available: true },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejette minSelect > maxSelect', () => {
    const result = supplementGroupSchema.safeParse({
      ...baseGroup,
      type: 'multiple',
      minSelect: 3,
      maxSelect: 1,
      options: [{ name: 'Chocolat', price: 0, available: true }],
    });
    expect(result.success).toBe(false);
  });
});
