import { describe, it, expect } from 'vitest';
import { buildGroupDriverRequestMessage } from './driver-messages';

describe('buildGroupDriverRequestMessage', () => {
  const base = {
    yangoLandmark: 'Cocody, face à la pharmacie',
    phone: '+225 07 00 00 00 00',
  };

  it('liste toutes les commandes dans un seul message', () => {
    const msg = buildGroupDriverRequestMessage({
      ...base,
      customerName: 'Awa',
      dailyNumbers: [14, 17, 21],
    });
    expect(msg).toContain('Bonjour Awa');
    expect(msg).toContain('3 commandes #014 · #017 · #021');
    expect(msg).toContain('Un seul livreur');
    expect(msg).toContain(base.yangoLandmark);
    expect(msg).toContain(base.phone);
  });

  it('salue sans nom quand le client est anonyme', () => {
    const msg = buildGroupDriverRequestMessage({
      ...base,
      customerName: null,
      dailyNumbers: [1, 2],
    });
    expect(msg.startsWith('Bonjour 👋\n\nTes 2 commandes')).toBe(true);
  });
});
