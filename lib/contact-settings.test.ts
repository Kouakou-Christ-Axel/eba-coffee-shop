// lib/contact-settings.test.ts
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CONTACT_SETTINGS,
  contactSettingsFromRow,
  contactSettingsSchema,
} from '@/lib/contact-settings';

describe('contactSettingsSchema — réseaux facultatifs', () => {
  it('accepte une chaîne vide (pas de compte sur ce réseau)', () => {
    const parsed = contactSettingsSchema.parse({
      ...DEFAULT_CONTACT_SETTINGS,
      facebookUrl: '',
      xUrl: '',
    });
    expect(parsed.facebookUrl).toBe('');
  });

  it('refuse une valeur non vide qui n’est pas une URL', () => {
    const result = contactSettingsSchema.safeParse({
      ...DEFAULT_CONTACT_SETTINGS,
      facebookUrl: 'eba.coffeeshop',
    });
    expect(result.success).toBe(false);
  });

  it('accepte une URL de page valide', () => {
    const parsed = contactSettingsSchema.parse({
      ...DEFAULT_CONTACT_SETTINGS,
      linkedinUrl: 'https://www.linkedin.com/company/eba-coffee-shop',
    });
    expect(parsed.linkedinUrl).toBe(
      'https://www.linkedin.com/company/eba-coffee-shop'
    );
  });
});

describe('contactSettingsFromRow', () => {
  it('retombe sur les défauts pour une ligne absente', () => {
    expect(contactSettingsFromRow(null)).toEqual(DEFAULT_CONTACT_SETTINGS);
  });

  it('ignore les colonnes null au lieu d’écraser le défaut', () => {
    // Cas d'une colonne ajoutée sans backfill : `null` ne doit pas fuiter dans
    // un champ typé `string`.
    const settings = contactSettingsFromRow({
      phone: '+225 01 61 33 99 43',
      facebookUrl: null,
    });
    expect(settings.phone).toBe('+225 01 61 33 99 43');
    expect(settings.facebookUrl).toBe('');
  });
});
