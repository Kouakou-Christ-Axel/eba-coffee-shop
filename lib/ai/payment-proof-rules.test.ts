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
