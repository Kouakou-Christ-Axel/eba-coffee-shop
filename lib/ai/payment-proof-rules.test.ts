import { describe, it, expect } from 'vitest';
import {
  blocksAutoValidation,
  buildUserPrompt,
  computeVerdict,
  isDateConsistent,
  normalizeAmount,
  operatorToPaymentMode,
  SYSTEM_PROMPT,
  type Analysis,
} from './payment-proof-rules';

const ORDER_CREATED_AT = new Date('2026-08-06T14:00:00Z');

/** Analyse « nominale » : capture lisible, montant exact, bénéficiaire
 * reconnu. Chaque test ne fait varier que le champ qu'il examine. */
function makeAnalysis(overrides: Partial<Analysis> = {}): Analysis {
  return {
    readable: true,
    operator: 'WAVE',
    amount: 9000,
    reference: 'TX-123',
    recipientName: 'EBA Coffee Shop',
    recipientMatch: 'MATCH',
    transactionStatus: 'SUCCESS',
    transactionDate: '2026-08-06T14:28:00',
    tamperingSuspected: false,
    tamperingReasons: null,
    confidence: 0.9,
    reasoning: 'Capture Wave, paiement au commerce.',
    ...overrides,
  };
}

function verdictOf(analysis: Analysis, orderTotal = 9000) {
  return computeVerdict({
    analysis,
    amount: normalizeAmount(analysis.amount),
    orderTotal,
    dateConsistent: isDateConsistent(
      analysis.transactionDate,
      ORDER_CREATED_AT
    ),
  });
}

describe('normalizeAmount', () => {
  it('ramène un débit affiché en négatif à sa valeur absolue', () => {
    // Cas réel : capture Djamo « -9.000F / Paiement Eba Coffee Shop » — le
    // signe décrit le débit du compte du client, pas le montant reçu.
    expect(normalizeAmount(-9000)).toBe(9000);
  });

  it('laisse un montant positif intact et propage null', () => {
    expect(normalizeAmount(9000)).toBe(9000);
    expect(normalizeAmount(null)).toBeNull();
  });
});

describe('computeVerdict', () => {
  it('accepte un paiement affiché en débit sur la capture du client', () => {
    const { verdict, amountMatches } = verdictOf(
      makeAnalysis({ amount: -9000, operator: 'DJAMO' })
    );
    expect(verdict).toBe('MATCH');
    expect(amountMatches).toBe(true);
  });

  it("accepte une capture dont l'application n'affiche aucun bénéficiaire", () => {
    const { verdict } = verdictOf(
      makeAnalysis({ recipientName: null, recipientMatch: 'UNKNOWN' })
    );
    expect(verdict).toBe('MATCH');
  });

  it('accepte une capture sans statut ni référence affichés', () => {
    const { verdict } = verdictOf(
      makeAnalysis({ transactionStatus: 'UNKNOWN', reference: null })
    );
    expect(verdict).toBe('MATCH');
  });

  it('accepte une capture sans date exploitable', () => {
    const { verdict } = verdictOf(makeAnalysis({ transactionDate: null }));
    expect(verdict).toBe('MATCH');
  });

  it('accepte un surpaiement et le signale', () => {
    const { verdict, overpaid } = verdictOf(makeAnalysis({ amount: 10000 }));
    expect(verdict).toBe('MATCH');
    expect(overpaid).toBe(true);
  });

  it('refuse une retouche matérielle avérée', () => {
    expect(verdictOf(makeAnalysis({ tamperingSuspected: true })).verdict).toBe(
      'MISMATCH'
    );
  });

  it('refuse un bénéficiaire manifestement autre', () => {
    expect(
      verdictOf(
        makeAnalysis({
          recipientName: 'Kouadio Yao',
          recipientMatch: 'MISMATCH',
        })
      ).verdict
    ).toBe('MISMATCH');
  });

  it('refuse une transaction échouée ou en attente', () => {
    expect(
      verdictOf(makeAnalysis({ transactionStatus: 'FAILED_OR_PENDING' }))
        .verdict
    ).toBe('MISMATCH');
  });

  it('refuse un montant insuffisant, y compris affiché en négatif', () => {
    expect(verdictOf(makeAnalysis({ amount: -5000 })).verdict).toBe('MISMATCH');
  });

  it('refuse un montant illisible', () => {
    expect(verdictOf(makeAnalysis({ amount: null })).verdict).toBe('MISMATCH');
  });

  it('refuse une capture antérieure à la commande (paiement recyclé)', () => {
    expect(
      verdictOf(makeAnalysis({ transactionDate: '2026-08-05T09:12:00' }))
        .verdict
    ).toBe('MISMATCH');
  });

  it('signale une capture illisible sans la confondre avec une fraude', () => {
    expect(
      verdictOf(makeAnalysis({ readable: false, amount: null })).verdict
    ).toBe('UNREADABLE');
  });
});

describe('isDateConsistent', () => {
  // Commande #24 du 06/08 (Mouna client, 3 000 F) : créée à 17h22 UTC,
  // capture datée 17h31. `new Date('2026-08-06T17:31:00')` parsait cette
  // heure murale dans le fuseau du runtime — sur un serveur à UTC+2 elle
  // devenait 15h31 UTC, soit « 1h51 avant la commande » → fausse alerte de
  // paiement recyclé. L'heure lue sur la capture est de l'heure d'Abidjan.
  const MOUNA_ORDER_CREATED_AT = new Date('2026-08-06T17:22:39.596Z');

  it('accepte une capture postérieure à la commande, quel que soit le fuseau du runtime', () => {
    expect(
      isDateConsistent('2026-08-06T17:31:00', MOUNA_ORDER_CREATED_AT)
    ).toBe(true);
  });

  it('interprète une heure sans fuseau comme de l’heure d’Abidjan', () => {
    // 17:31 Abidjan = 17:31 UTC : à la seconde près sur la borne de tolérance
    // (2 h avant la commande), pas 2 h plus tôt comme sur un runtime UTC+2.
    expect(
      isDateConsistent('2026-08-06T15:23:00', MOUNA_ORDER_CREATED_AT)
    ).toBe(true);
    expect(
      isDateConsistent('2026-08-06T15:21:00', MOUNA_ORDER_CREATED_AT)
    ).toBe(false);
  });

  it('respecte un décalage explicite quand le modèle en fournit un', () => {
    expect(
      isDateConsistent('2026-08-06T19:31:00+02:00', MOUNA_ORDER_CREATED_AT)
    ).toBe(true);
    expect(
      isDateConsistent('2026-08-06T17:31:00Z', MOUNA_ORDER_CREATED_AT)
    ).toBe(true);
  });

  it('tolère un paiement fait avant la saisie de la commande en caisse', () => {
    // Le client paie, la caisse saisit la commande une heure plus tard.
    expect(
      isDateConsistent('2026-08-06T16:30:00', MOUNA_ORDER_CREATED_AT)
    ).toBe(true);
  });

  it('compare au jour civil quand la capture ne porte pas d’heure', () => {
    // Sans cette règle, minuit passerait pour antérieur à toute commande de
    // l'après-midi.
    expect(isDateConsistent('2026-08-06', MOUNA_ORDER_CREATED_AT)).toBe(true);
    expect(isDateConsistent('2026-08-05', MOUNA_ORDER_CREATED_AT)).toBe(false);
  });

  it('signale toujours une capture de la veille', () => {
    expect(
      isDateConsistent('2026-08-05T17:31:00', MOUNA_ORDER_CREATED_AT)
    ).toBe(false);
  });

  it('ne juge pas en l’absence de date exploitable', () => {
    expect(isDateConsistent(null, MOUNA_ORDER_CREATED_AT)).toBeNull();
    expect(isDateConsistent('hier soir', MOUNA_ORDER_CREATED_AT)).toBeNull();
    expect(
      isDateConsistent('2026-13-45T99:99:00', MOUNA_ORDER_CREATED_AT)
    ).toBeNull();
  });
});

describe('blocksAutoValidation', () => {
  it("retient l'encaissement quand le bénéficiaire n'est pas identifiable", () => {
    expect(
      blocksAutoValidation(makeAnalysis({ recipientMatch: 'UNKNOWN' }))
    ).toBeTypeOf('string');
  });

  it('laisse passer un bénéficiaire reconnu', () => {
    expect(blocksAutoValidation(makeAnalysis())).toBeNull();
  });
});

describe('operatorToPaymentMode', () => {
  it('mappe les opérateurs connus et rabat le reste sur OTHER', () => {
    expect(operatorToPaymentMode('WAVE')).toBe('WAVE');
    expect(operatorToPaymentMode('ORANGE_MONEY')).toBe('ORANGE_MONEY');
    expect(operatorToPaymentMode('DJAMO')).toBe('OTHER');
    expect(operatorToPaymentMode('BANK')).toBe('OTHER');
    expect(operatorToPaymentMode('UNKNOWN')).toBe('OTHER');
  });
});

describe('prompts', () => {
  it('interdit explicitement de traiter une interface inconnue comme une fraude', () => {
    expect(SYSTEM_PROMPT).toContain('interface que tu ne reconnais pas');
  });

  it('annonce les autres applications de paiement au modèle', () => {
    const prompt = buildUserPrompt(
      { total: 9000, createdAt: ORDER_CREATED_AT },
      '0700000000',
      '0500000000'
    );
    expect(prompt).toContain('9000 FCFA');
    expect(prompt).toContain('Djamo');
    expect(prompt).toContain('négatif');
  });
});
