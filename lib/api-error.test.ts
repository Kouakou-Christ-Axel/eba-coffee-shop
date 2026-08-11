import { describe, expect, it } from 'vitest';
import { extractApiError, readApiError } from './api-error';

describe('extractApiError', () => {
  it('renvoie une erreur métier sous forme de chaîne', () => {
    expect(extractApiError('Stock insuffisant pour Crêpe')).toBe(
      'Stock insuffisant pour Crêpe'
    );
  });

  it('ignore une chaîne vide', () => {
    expect(extractApiError('   ')).toBeNull();
  });

  it('lit les erreurs globales de ZodError.flatten()', () => {
    expect(
      extractApiError({ formErrors: ['Corps invalide'], fieldErrors: {} })
    ).toBe('Corps invalide');
  });

  it('nomme le champ fautif dans une erreur de validation', () => {
    // Le cas qui affichait « Erreur 400 » au caissier.
    expect(
      extractApiError({
        formErrors: [],
        fieldErrors: { items: ['Le panier ne peut pas être vide'] },
      })
    ).toBe('items : Le panier ne peut pas être vide');
  });

  it('préfère une erreur globale à une erreur de champ', () => {
    expect(
      extractApiError({
        formErrors: ['Requête refusée'],
        fieldErrors: { items: ['…'] },
      })
    ).toBe('Requête refusée');
  });

  it('renvoie null quand il ny a rien dexploitable', () => {
    expect(extractApiError(undefined)).toBeNull();
    expect(extractApiError({ formErrors: [], fieldErrors: {} })).toBeNull();
  });
});

describe('readApiError', () => {
  it('retombe sur le statut quand le corps nest pas du JSON', async () => {
    const res = new Response('pas du json', { status: 500 });
    await expect(readApiError(res)).resolves.toBe('Erreur 500');
  });

  it('retombe sur le statut quand le corps na pas de champ error', async () => {
    const res = Response.json({ ok: false }, { status: 400 });
    await expect(readApiError(res)).resolves.toBe('Erreur 400');
  });

  it('remonte le message de validation', async () => {
    const res = Response.json(
      { error: { formErrors: [], fieldErrors: { total: ['Total invalide'] } } },
      { status: 400 }
    );
    await expect(readApiError(res)).resolves.toBe('total : Total invalide');
  });
});
