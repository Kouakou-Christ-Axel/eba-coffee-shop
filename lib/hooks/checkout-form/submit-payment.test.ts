import { afterEach, describe, expect, it, vi } from 'vitest';
import { submitCheckout } from '../use-checkout-form';
import { mockItems, validValues } from './test-fixtures';

describe('submitCheckout — paiement en ligne', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('envoie le moyen choisi, et l’omet sans paiement en ligne', async () => {
    const spy = vi.spyOn(global, 'fetch').mockImplementation(
      async () =>
        new Response(JSON.stringify({ id: 'o1', reference: 'EBA-1' }), {
          status: 201,
        })
    );

    await submitCheckout({
      values: { ...validValues, paymentMethod: 'orange' },
      items: mockItems,
      total: 3500,
    });
    await submitCheckout({
      values: validValues,
      items: mockItems,
      total: 3500,
    });

    expect(spy.mock.calls[0][1]?.body as string).toContain(
      '"paymentMethod":"orange"'
    );
    expect(spy.mock.calls[1][1]?.body as string).not.toContain('paymentMethod');
  });

  it("renvoie l'URL de paiement vers laquelle rediriger", async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'o1',
          reference: 'EBA-1',
          paymentUrl: 'https://pay.jeko.africa/pay_request/pr/x',
          expiresAt: '2026-10-03T12:15:00.000Z',
        }),
        { status: 201 }
      )
    );

    const out = await submitCheckout({
      values: { ...validValues, paymentMethod: 'wave' },
      items: mockItems,
      total: 3500,
    });

    expect(out).toEqual({
      ok: true,
      orderId: 'o1',
      reference: 'EBA-1',
      paymentUrl: 'https://pay.jeko.africa/pay_request/pr/x',
      paymentError: false,
    });
  });

  it("signale que le paiement n'a pas démarré quand Jèko est tombé après la création", async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'o1',
          reference: 'EBA-1',
          paymentUrl: null,
          paymentError: 'PAYMENT_PROVIDER_ERROR',
        }),
        { status: 201 }
      )
    );

    const out = await submitCheckout({
      values: { ...validValues, paymentMethod: 'wave' },
      items: mockItems,
      total: 3500,
    });

    // La commande existe : le client ira sur la page de suivi, où « Réessayer »
    // relance le paiement.
    expect(out).toEqual({
      ok: true,
      orderId: 'o1',
      reference: 'EBA-1',
      paymentUrl: null,
      paymentError: true,
    });
  });

  it('CART_CHANGED (409) demande de recharger la carte, sans créer de commande', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'CART_CHANGED',
          reason: 'price_changed',
          error: 'Le prix de « Cappuccino » a changé',
        }),
        { status: 409 }
      )
    );

    const out = await submitCheckout({
      values: { ...validValues, paymentMethod: 'wave' },
      items: mockItems,
      total: 3500,
    });

    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.code).toBe('CART_CHANGED');
      expect(out.error).toMatch(/prix|menu|carte/i);
    }
  });
});
