// lib/orders/payment-panel.test.ts
//
// Logique PURE de la section « Paiement » de la page de suivi : quel état afficher,
// compte à rebours, lecture du retour de chez Jèko, messages d'erreur. Le composant
// n'ajoute que du JSX — tout ce qui peut se tromper est testé ici.

import { describe, expect, it } from 'vitest';
import {
  formatCountdown,
  getPaymentPanelKind,
  parsePaymentReturn,
  paymentStartErrorMessage,
} from './payment-panel';

const pending = {
  state: 'pending' as const,
  onlineFee: 30,
  amountDue: 3030,
  expiresAt: '2026-10-03T12:15:00.000Z',
};

const order = {
  isPaid: false,
  status: 'NEW' as const,
  total: 3000,
  depositRequired: null as number | null,
  depositPaid: null as number | null,
  payment: pending as {
    state: 'none' | 'pending' | 'expired' | 'paid';
    onlineFee: number | null;
    amountDue: number;
    expiresAt: string | null;
  },
};

describe('getPaymentPanelKind', () => {
  it('en attente de paiement, sans retour de chez Jèko : pending', () => {
    expect(getPaymentPanelKind(order, null)).toBe('pending');
  });

  it('de retour avec succès mais pas encore payée : verifying', () => {
    expect(getPaymentPanelKind(order, 'ok')).toBe('verifying');
  });

  it('de retour avec un échec : failed (le client peut réessayer)', () => {
    expect(getPaymentPanelKind(order, 'echec')).toBe('failed');
  });

  it('payée : paid, quel que soit le retour', () => {
    const paid = {
      ...order,
      isPaid: true,
      payment: { ...pending, state: 'paid' as const },
    };
    expect(getPaymentPanelKind(paid, null)).toBe('paid');
    expect(getPaymentPanelKind(paid, 'echec')).toBe('paid');
  });

  it('payée après annulation ou expiration : late_paid', () => {
    const late = {
      ...order,
      isPaid: true,
      status: 'CANCELLED' as const,
      payment: { ...pending, state: 'paid' as const },
    };
    expect(getPaymentPanelKind(late, 'ok')).toBe('late_paid');
  });

  it('délai dépassé : expired, même si le client revient de chez Jèko', () => {
    const expired = {
      ...order,
      payment: { ...pending, state: 'expired' as const },
    };
    expect(getPaymentPanelKind(expired, null)).toBe('expired');
    expect(getPaymentPanelKind(expired, 'ok')).toBe('expired');
  });

  it('total nul (récompense qui couvre tout) : rien à payer', () => {
    expect(getPaymentPanelKind({ ...order, total: 0 }, null)).toBe(
      'nothing_due'
    );
  });

  it('acompte déjà versé (commande de caisse) : deposit_paid', () => {
    expect(
      getPaymentPanelKind(
        {
          ...order,
          depositRequired: 1500,
          depositPaid: 1500,
          payment: { ...pending, state: 'none' },
        },
        null
      )
    ).toBe('deposit_paid');
  });

  it('commande sans paiement en ligne : à régler au comptoir', () => {
    expect(
      getPaymentPanelKind(
        { ...order, payment: { ...pending, state: 'none' } },
        null
      )
    ).toBe('counter');
  });
});

describe('parsePaymentReturn', () => {
  it('lit les deux valeurs que le serveur écrit dans les URLs de retour', () => {
    expect(parsePaymentReturn('ok')).toBe('ok');
    expect(parsePaymentReturn('echec')).toBe('echec');
  });

  it.each([undefined, '', 'autre', ['ok', 'echec'], 'OK'])(
    'ignore toute autre valeur (%j) : un lien trafiqué ne change rien',
    (value) => {
      expect(parsePaymentReturn(value as string | undefined)).toBeNull();
    }
  );
});

describe('formatCountdown', () => {
  it('affiche minutes:secondes', () => {
    expect(formatCountdown(14 * 60_000 + 32_000)).toBe('14:32');
    expect(formatCountdown(61_000)).toBe('1:01');
    expect(formatCountdown(9_000)).toBe('0:09');
  });

  it('arrondit à la seconde supérieure : jamais 0:00 tant qu’il reste du temps', () => {
    expect(formatCountdown(500)).toBe('0:01');
  });

  it('ne descend jamais sous zéro', () => {
    expect(formatCountdown(0)).toBe('0:00');
    expect(formatCountdown(-5_000)).toBe('0:00');
  });
});

describe('paymentStartErrorMessage', () => {
  it.each([
    ['expired', /délai|expir/i],
    ['already_paid', /déjà payée/i],
    ['cancelled', /annulée/i],
  ])('commande non payable (%s) : message explicite', (reason, pattern) => {
    expect(paymentStartErrorMessage(409, { code: 'CONFLICT', reason })).toMatch(
      pattern
    );
  });

  it('trop de tentatives (429)', () => {
    expect(paymentStartErrorMessage(429, { code: 'RATE_LIMITED' })).toMatch(
      /tentatives/i
    );
  });

  it('panne du fournisseur (502/503) : réessayer dans un instant', () => {
    expect(
      paymentStartErrorMessage(502, { code: 'PAYMENT_PROVIDER_ERROR' })
    ).toMatch(/indisponible|instant/i);
  });

  it('erreur inconnue : message générique, jamais le texte brut du serveur', () => {
    const msg = paymentStartErrorMessage(500, {
      code: 'SERVER_ERROR',
      error: 'stack trace secrète',
    } as never);
    expect(msg).toMatch(/réessaie/i);
    expect(msg).not.toContain('secrète');
  });
});
