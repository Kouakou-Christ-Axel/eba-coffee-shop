// lib/phone.test.ts
import { describe, it, expect } from 'vitest';
import {
  customerPhoneKey,
  normalizeIvorianPhone,
  upgradeLegacyIvorianPhone,
} from '@/lib/phone';

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

  it('produit la même clé pour un ancien numéro (8 chiffres) et son équivalent moderne', () => {
    expect(customerPhoneKey('87878895')).toBe(customerPhoneKey('0787878895'));
  });
});

describe('upgradeLegacyIvorianPhone — bascule ARTCI 8 → 10 chiffres', () => {
  it('convertit un ancien numéro Orange (préfixe 87)', () => {
    expect(upgradeLegacyIvorianPhone('87878895')).toBe('0787878895');
  });

  it('convertit un ancien numéro MTN (préfixe 45)', () => {
    expect(upgradeLegacyIvorianPhone('45123456')).toBe('0545123456');
  });

  it('convertit un ancien numéro Moov (préfixe 71)', () => {
    expect(upgradeLegacyIvorianPhone('71123456')).toBe('0171123456');
  });

  it('nettoie espaces / tirets avant traitement', () => {
    expect(upgradeLegacyIvorianPhone('87 87-88 95')).toBe('0787878895');
  });

  it('est idempotent sur un numéro déjà à 10 chiffres', () => {
    expect(upgradeLegacyIvorianPhone('0787878895')).toBe('0787878895');
    expect(upgradeLegacyIvorianPhone('0545123456')).toBe('0545123456');
    expect(upgradeLegacyIvorianPhone('0171123456')).toBe('0171123456');
  });

  it('rejette une longueur ni 8 ni 10 chiffres', () => {
    expect(() => upgradeLegacyIvorianPhone('1234567')).toThrow();
    expect(() => upgradeLegacyIvorianPhone('123456789')).toThrow();
  });

  it('rejette une entrée sans chiffres exploitables', () => {
    expect(() => upgradeLegacyIvorianPhone('abcdefgh')).toThrow();
  });
});

describe('normalizeIvorianPhone — intégration ancien format 8 chiffres', () => {
  it('normalise directement un ancien numéro local en E.164', () => {
    expect(normalizeIvorianPhone('87878895')).toBe('+2250787878895');
  });

  it('retourne null si le préfixe à 8 chiffres est inconnu', () => {
    expect(normalizeIvorianPhone('99999999')).toBeNull();
  });
});
