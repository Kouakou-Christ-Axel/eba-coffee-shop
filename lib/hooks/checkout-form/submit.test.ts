import { afterEach, describe, expect, it, vi } from 'vitest';
import { submitCheckout } from '../use-checkout-form';
import { mockItems, validValues } from './test-fixtures';

describe('submitCheckout', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('POST vers /api/commandes avec un body bien formé', async () => {
    const spy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ id: 'clo123' }), { status: 201 })
      );

    await submitCheckout({
      values: validValues,
      items: mockItems,
      total: 3500,
    });

    expect(spy).toHaveBeenCalledWith(
      '/api/commandes',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"customerName":"Kofi Yao"'),
      })
    );
  });

  it('inclut le champ `note` quand renseigné', async () => {
    const spy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ id: 'clo123' }), { status: 201 })
      );

    await submitCheckout({
      values: { ...validValues, note: 'Sans sucre' },
      items: mockItems,
      total: 3500,
    });

    const body = String(
      (spy.mock.calls[0]?.[1] as RequestInit | undefined)?.body ?? ''
    );
    expect(body).toContain('"note":"Sans sucre"');
  });

  it('omet le champ `note` quand vide', async () => {
    const spy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ id: 'clo123' }), { status: 201 })
      );

    await submitCheckout({
      values: validValues,
      items: mockItems,
      total: 3500,
    });

    const body = String(
      (spy.mock.calls[0]?.[1] as RequestInit | undefined)?.body ?? ''
    );
    expect(body).not.toContain('"note"');
  });

  it('mappe le mode de récupération sur orderType et le timing sur pickupTime', async () => {
    const spy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ id: 'clo123' }), { status: 201 })
      );

    await submitCheckout({
      values: { ...validValues, pickupMode: 'driver', timing: 'asap' },
      items: mockItems,
      total: 3500,
    });
    await submitCheckout({
      values: { ...validValues, pickupMode: 'pickup', timing: 'scheduled' },
      items: mockItems,
      total: 3500,
    });

    const first = String(
      (spy.mock.calls[0]?.[1] as RequestInit | undefined)?.body ?? ''
    );
    const second = String(
      (spy.mock.calls[1]?.[1] as RequestInit | undefined)?.body ?? ''
    );
    expect(first).toContain('"orderType":"DELIVERY"');
    expect(first).toContain('"pickupTime":null');
    expect(second).toContain('"orderType":"TAKEAWAY"');
    expect(second).toContain(`"pickupTime":"${validValues.pickupTime}"`);
  });

  it('retourne { ok: true, orderId, reference } sur succès', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ id: 'clo123', reference: 'EBA-20260730-AB12' }),
        { status: 201 }
      )
    );

    const out = await submitCheckout({
      values: validValues,
      items: mockItems,
      total: 3500,
    });

    expect(out).toEqual({
      ok: true,
      orderId: 'clo123',
      reference: 'EBA-20260730-AB12',
      // Pas de paiement en ligne (flux historique) : rien vers quoi rediriger.
      paymentUrl: null,
      paymentError: false,
    });
  });

  it('inclut loyaltyRewardId quand une récompense est appliquée, l’omet sinon', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'clo123', reference: 'EBA-1' }), {
        status: 201,
      })
    );

    await submitCheckout({
      values: validValues,
      items: mockItems,
      total: 3500,
      loyaltyRewardId: 'reward-1',
    });
    await submitCheckout({
      values: validValues,
      items: mockItems,
      total: 3500,
      loyaltyRewardId: null,
    });

    const first = String(
      (spy.mock.calls[0]?.[1] as RequestInit | undefined)?.body ?? ''
    );
    const second = String(
      (spy.mock.calls[1]?.[1] as RequestInit | undefined)?.body ?? ''
    );
    expect(first).toContain('"loyaltyRewardId":"reward-1"');
    // Le total envoyé reste le total BRUT : le serveur déduit la remise.
    expect(first).toContain('"total":3500');
    expect(second).not.toContain('"loyaltyRewardId"');
  });

  it('mappe le 400 « récompense indisponible » sur un message actionnable', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'LOYALTY_REWARD_UNAVAILABLE',
          error: 'Récompense fidélité indisponible',
        }),
        {
          status: 400,
        }
      )
    );

    const out = await submitCheckout({
      values: validValues,
      items: mockItems,
      total: 3500,
      loyaltyRewardId: 'reward-1',
    });

    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toMatch(/sans la récompense/i);
  });

  it('retourne { ok: false, error } sur 400', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'invalid' }), { status: 400 })
    );

    const out = await submitCheckout({
      values: validValues,
      items: mockItems,
      total: 3500,
    });

    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toMatch(/erreur/i);
  });

  it('SOLD_OUT_TODAY (409) remonte les lignes épuisées, sans message générique', async () => {
    const line = {
      cartId: 'abc',
      productId: 'prod-1',
      productName: 'Cappuccino',
      missingProduct: true,
      missingOptionNames: [],
      remaining: 0,
    };
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'SOLD_OUT_TODAY',
          error: 'Cappuccino : épuisé aujourd’hui.',
          items: [line],
        }),
        { status: 409 }
      )
    );

    const out = await submitCheckout({
      values: validValues,
      items: mockItems,
      total: 3500,
    });

    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.code).toBe('SOLD_OUT_TODAY');
      expect(out.soldOutLines).toEqual([line]);
      expect(out.error).not.toMatch(/une erreur est survenue/i);
    }
  });

  it('rattache un délai à l’avance au sélecteur de créneau', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'ADVANCE_ORDER_REQUIRED',
          error:
            "Cet article doit être commandé au moins 2 jour(s) à l'avance.",
          requiredDays: 2,
        }),
        { status: 400 }
      )
    );

    const out = await submitCheckout({
      values: validValues,
      items: mockItems,
      total: 3500,
    });

    expect(out).toMatchObject({
      ok: false,
      field: 'pickupTime',
      error: expect.stringContaining('2 jour(s)'),
    });
  });

  it('une 500 rassure : la commande n’a pas été enregistrée', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ code: 'SERVER_ERROR', error: 'Erreur serveur' }),
        { status: 500 }
      )
    );

    const out = await submitCheckout({
      values: validValues,
      items: mockItems,
      total: 3500,
    });

    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toMatch(/pas été enregistrée/);
  });

  it('retourne { ok: false, error } sur erreur réseau', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network'));

    const out = await submitCheckout({
      values: validValues,
      items: mockItems,
      total: 3500,
    });

    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toMatch(/serveur/i);
  });
});

// ─── Paiement en ligne (Jèko) ────────────────────────────────────────────────
