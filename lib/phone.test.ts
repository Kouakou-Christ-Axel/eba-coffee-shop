// lib/phone.test.ts
import { describe, it, expect } from 'vitest';
import { customerPhoneKey, normalizeIvorianPhone } from '@/lib/phone';

describe('customerPhoneKey — dédoublonnage', () => {
  it('produit la même clé pour les variantes d’un même numéro CI', () => {
    const variants = [
      '07 88 12 34 56',
      '+225 07 88 12 34 56',
      '00225 0788123456',
      '2250788123456',
      '0788123456',
    ];
    const keys = variants.map(customerPhoneKey);
    expect(new Set(keys).size).toBe(1);
    expect(keys[0]).toBe('+2250788123456');
  });

  it('retombe sur les chiffres bruts si le format n’est pas reconnu', () => {
    // Trop court pour un numéro CI mais exploitable comme clé brute.
    expect(customerPhoneKey('123456')).toBe('123456');
  });

  it('retourne null pour une entrée vide ou inexploitable', () => {
    expect(customerPhoneKey(null)).toBeNull();
    expect(customerPhoneKey('')).toBeNull();
    expect(customerPhoneKey('12')).toBeNull();
  });

  it('cohérent avec normalizeIvorianPhone quand le numéro est valide', () => {
    const raw = '0788123456';
    expect(customerPhoneKey(raw)).toBe(normalizeIvorianPhone(raw));
  });
});
