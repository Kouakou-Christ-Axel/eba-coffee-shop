// lib/expense-units.test.ts
import { describe, it, expect } from 'vitest';
import { toBaseQty, convertUnitPrice, BASE_UNITS } from '@/lib/expense-units';

describe('BASE_UNITS', () => {
  it('expose les 5 unités de base attendues', () => {
    expect(BASE_UNITS).toEqual(['kg', 'g', 'L', 'mL', 'unite']);
  });
});

describe('toBaseQty', () => {
  it('même unité que baseUnit : simple produit formatQty × formatSize', () => {
    expect(
      toBaseQty({ formatQty: 2, formatSize: 5, unit: 'kg', baseUnit: 'kg' })
    ).toBe(10);
  });

  it('conversion masse g → kg', () => {
    expect(
      toBaseQty({ formatQty: 2, formatSize: 500, unit: 'g', baseUnit: 'kg' })
    ).toBe(1);
  });

  it('conversion masse kg → g', () => {
    expect(
      toBaseQty({ formatQty: 2, formatSize: 25, unit: 'kg', baseUnit: 'g' })
    ).toBe(50000);
  });

  it('conversion volume mL → L', () => {
    expect(
      toBaseQty({ formatQty: 3, formatSize: 500, unit: 'mL', baseUnit: 'L' })
    ).toBe(1.5);
  });

  it('conversion volume L → mL', () => {
    expect(
      toBaseQty({ formatQty: 1, formatSize: 2, unit: 'L', baseUnit: 'mL' })
    ).toBe(2000);
  });

  it('unite : identité, pas de conversion', () => {
    expect(
      toBaseQty({
        formatQty: 4,
        formatSize: 6,
        unit: 'unite',
        baseUnit: 'unite',
      })
    ).toBe(24);
  });

  it('dimensions incompatibles (masse vers volume/unité) → null', () => {
    expect(
      toBaseQty({ formatQty: 1, formatSize: 1, unit: 'kg', baseUnit: 'L' })
    ).toBeNull();
    expect(
      toBaseQty({ formatQty: 1, formatSize: 1, unit: 'kg', baseUnit: 'unite' })
    ).toBeNull();
  });

  it('formatQty manquant/non fini → null', () => {
    expect(toBaseQty({ formatSize: 5, unit: 'kg', baseUnit: 'kg' })).toBeNull();
    expect(
      toBaseQty({
        formatQty: null,
        formatSize: 5,
        unit: 'kg',
        baseUnit: 'kg',
      })
    ).toBeNull();
    expect(
      toBaseQty({
        formatQty: Number.POSITIVE_INFINITY,
        formatSize: 5,
        unit: 'kg',
        baseUnit: 'kg',
      })
    ).toBeNull();
  });

  it('baseUnit manquant → null', () => {
    expect(
      toBaseQty({ formatQty: 2, formatSize: 5, unit: 'kg', baseUnit: null })
    ).toBeNull();
  });

  it('formatSize absent : suppose 1 (formatQty seul)', () => {
    expect(toBaseQty({ formatQty: 3, unit: 'kg', baseUnit: 'kg' })).toBe(3);
  });

  it('unit absent : suppose déjà exprimé dans baseUnit (pas de conversion)', () => {
    expect(
      toBaseQty({ formatQty: 2, formatSize: 3, unit: null, baseUnit: 'kg' })
    ).toBe(6);
  });

  it('unité inconnue (ni celle du référentiel) → null', () => {
    expect(
      toBaseQty({
        formatQty: 1,
        formatSize: 1,
        unit: 'carton',
        baseUnit: 'kg',
      })
    ).toBeNull();
  });

  it('arrondit à 3 décimales', () => {
    expect(
      toBaseQty({ formatQty: 1, formatSize: 1, unit: 'g', baseUnit: 'kg' })
    ).toBe(0.001);
    expect(
      toBaseQty({
        formatQty: 1,
        formatSize: 1.0001,
        unit: 'kg',
        baseUnit: 'kg',
      })
    ).toBe(1);
  });
});

describe('convertUnitPrice', () => {
  it('identité quand les unités sont les mêmes', () => {
    expect(convertUnitPrice({ price: 900, fromUnit: 'kg', toUnit: 'kg' })).toBe(
      900
    );
  });

  it('identité quand une unité manque des deux côtés', () => {
    expect(convertUnitPrice({ price: 900, fromUnit: null, toUnit: 'kg' })).toBe(
      900
    );
    expect(convertUnitPrice({ price: 900, fromUnit: 'kg', toUnit: null })).toBe(
      900
    );
  });

  it('un prix par kg vaut 1000× moins par g (sous 1 F ⇒ null)', () => {
    // 900 F/kg = 0,9 F/g : inexprimable en entier sans fausser le montant.
    expect(convertUnitPrice({ price: 900, fromUnit: 'kg', toUnit: 'g' })).toBe(
      null
    );
  });

  it('un prix par kg reste exploitable par g quand il est assez élevé', () => {
    expect(
      convertUnitPrice({ price: 12000, fromUnit: 'kg', toUnit: 'g' })
    ).toBe(12);
  });

  it('un prix par g vaut 1000× plus par kg', () => {
    expect(convertUnitPrice({ price: 2, fromUnit: 'g', toUnit: 'kg' })).toBe(
      2000
    );
  });

  it('convertit dans la famille volume', () => {
    expect(convertUnitPrice({ price: 3, fromUnit: 'mL', toUnit: 'L' })).toBe(
      3000
    );
    expect(convertUnitPrice({ price: 4000, fromUnit: 'L', toUnit: 'mL' })).toBe(
      4
    );
  });

  it('refuse une conversion entre familles incompatibles', () => {
    expect(
      convertUnitPrice({ price: 900, fromUnit: 'kg', toUnit: 'unite' })
    ).toBe(null);
    expect(convertUnitPrice({ price: 900, fromUnit: 'L', toUnit: 'kg' })).toBe(
      null
    );
  });

  it('refuse une unité inconnue', () => {
    expect(
      convertUnitPrice({ price: 900, fromUnit: 'sac', toUnit: 'kg' })
    ).toBe(null);
  });

  it('refuse un prix absent, non fini ou négatif', () => {
    expect(
      convertUnitPrice({ price: null, fromUnit: 'kg', toUnit: 'kg' })
    ).toBe(null);
    expect(
      convertUnitPrice({ price: undefined, fromUnit: 'kg', toUnit: 'kg' })
    ).toBe(null);
    expect(convertUnitPrice({ price: NaN, fromUnit: 'kg', toUnit: 'kg' })).toBe(
      null
    );
    expect(convertUnitPrice({ price: -5, fromUnit: 'kg', toUnit: 'kg' })).toBe(
      null
    );
  });

  it('refuse un prix qui s’arrondirait à 0 F', () => {
    expect(convertUnitPrice({ price: 0, fromUnit: 'kg', toUnit: 'kg' })).toBe(
      null
    );
  });
});
