import { describe, expect, it } from 'vitest';
import { describeTransferFailure } from './transfer-errors';

describe('describeTransferFailure', () => {
  it('sans compte : texte historique, variables JEKO_ du compte A', () => {
    const a = describeTransferFailure('unauthorized');
    expect(a.action).toBe('Vérifier les clés JEKO_API_KEY et JEKO_API_KEY_ID.');
    expect(a.message).toBe('Clés API Jèko refusées');
  });

  it('compte B : variables JEKO_B_ et compte nommé dans le message', () => {
    expect(describeTransferFailure('unauthorized', 'B')).toMatchObject({
      message: 'Compte B : Clés API Jèko refusées',
      action: 'Vérifier les clés JEKO_B_API_KEY et JEKO_B_API_KEY_ID.',
    });
    expect(describeTransferFailure('store_not_found', 'B').action).toBe(
      'Vérifier JEKO_B_STORE_ID.'
    );
    expect(describeTransferFailure('jeko_not_configured', 'B').action).toBe(
      'Renseigner les variables JEKO_B_* puis réessayer.'
    );
  });

  it('un échec sans lien avec la configuration ne change pas selon le compte', () => {
    expect(describeTransferFailure('insufficient_balance', 'B')).toEqual(
      describeTransferFailure('insufficient_balance')
    );
  });

  it('code inconnu : conseil générique', () => {
    expect(describeTransferFailure('nope', 'B').message).toBe(
      'Échec du transfert'
    );
  });
});
