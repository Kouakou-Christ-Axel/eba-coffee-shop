import { describe, expect, it } from 'vitest';
import { maskPhone, maskPhonesDeep } from './mask-pii';

describe('maskPhonesDeep', () => {
  it('masque les clés téléphone à tous les niveaux et garde les ids', () => {
    const out = maskPhonesDeep({
      customers: [
        { id: 'c1', name: 'Awa', phone: '+2250712345678', total: 5000 },
      ],
      order: { customerPhone: '07 12 34 56 78', driverPhone: null },
    });
    expect(out).toEqual({
      customers: [{ id: 'c1', name: 'Awa', phone: '****78', total: 5000 }],
      order: { customerPhone: '****78', driverPhone: null },
    });
  });

  it('ne laisse jamais le numéro complet dans la sortie', () => {
    expect(
      JSON.stringify(maskPhonesDeep({ phone: '+2250712345678' }))
    ).not.toContain('0712345678');
    expect(maskPhone('12')).toBe('****');
  });
});
