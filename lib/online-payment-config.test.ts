// lib/online-payment-config.test.ts
//
// Ce que le checkout lit de `GET /api/paiement/config`. La réponse vient du réseau :
// on n'en croit que ce qui est bien formé, et on ne propose JAMAIS un moyen que le
// serveur ne sait pas traiter (un moyen inconnu ferait échouer la commande).

import { describe, expect, it } from 'vitest';
import { parseOnlinePaymentConfig } from './online-payment-config';

describe('parseOnlinePaymentConfig', () => {
  it('lit une configuration active', () => {
    expect(
      parseOnlinePaymentConfig({
        enabled: true,
        feePercent: 1,
        methods: ['wave', 'orange'],
      })
    ).toEqual({ enabled: true, feePercent: 1, methods: ['wave', 'orange'] });
  });

  it('lit une configuration inerte', () => {
    expect(
      parseOnlinePaymentConfig({ enabled: false, feePercent: 0, methods: [] })
    ).toEqual({ enabled: false, feePercent: 0, methods: [] });
  });

  it('écarte les moyens inconnus', () => {
    expect(
      parseOnlinePaymentConfig({
        enabled: true,
        feePercent: 1,
        methods: ['wave', 'bitcoin', 'jeko', 'mtn'],
      })?.methods
    ).toEqual(['wave', 'mtn']);
  });

  it('considère inactif un paiement « actif » sans aucun moyen utilisable', () => {
    expect(
      parseOnlinePaymentConfig({
        enabled: true,
        feePercent: 1,
        methods: ['bitcoin'],
      })
    ).toMatchObject({ enabled: false, methods: [] });
  });

  it.each([
    null,
    undefined,
    'texte',
    42,
    [],
    {},
    { enabled: 'oui', feePercent: 1, methods: [] },
    { enabled: true, feePercent: -1, methods: ['wave'] },
    { enabled: true, feePercent: 'beaucoup', methods: ['wave'] },
    { enabled: true, feePercent: 1, methods: 'wave' },
  ])('refuse une réponse mal formée (%j)', (data) => {
    expect(parseOnlinePaymentConfig(data)).toBeNull();
  });
});
