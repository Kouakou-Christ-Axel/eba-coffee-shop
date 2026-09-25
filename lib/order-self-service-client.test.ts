// lib/order-self-service-client.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cancelOrder,
  changeOrderItems,
  rescheduleOrder,
} from './order-self-service-client';

afterEach(() => vi.restoreAllMocks());

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status });

describe('order-self-service-client', () => {
  it('renvoie la commande à jour en cas de succès', async () => {
    const spy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        json({ order: { id: 'o1', status: 'CANCELLED' } }, 200)
      );

    const out = await cancelOrder('o1');

    expect(spy).toHaveBeenCalledWith(
      '/api/commandes/o1/annulation',
      expect.objectContaining({ method: 'POST' })
    );
    expect(out).toEqual({ ok: true, order: { id: 'o1', status: 'CANCELLED' } });
  });

  it('envoie les changements d’articles et le créneau en JSON', async () => {
    const spy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(json({ order: { id: 'o1' } }, 200));

    await changeOrderItems('o1', [{ cartId: 'a', action: 'remove' }]);
    await rescheduleOrder('o1', null);

    expect(spy.mock.calls[0][0]).toBe('/api/commandes/o1/articles');
    expect(spy.mock.calls[0][1]?.body).toBe(
      JSON.stringify({ changes: [{ cartId: 'a', action: 'remove' }] })
    );
    expect(spy.mock.calls[1][1]?.body).toBe(
      JSON.stringify({ pickupTime: null })
    );
  });

  it('montre le message métier du serveur et remonte les lignes épuisées', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      json(
        {
          code: 'SOLD_OUT_TODAY',
          error: 'Brownie : épuisé aujourd’hui.',
          items: [{ cartId: 'n1' }],
        },
        409
      )
    );

    const out = await changeOrderItems('o1', [
      { cartId: 'a', action: 'remove' },
    ]);

    expect(out).toMatchObject({
      ok: false,
      code: 'SOLD_OUT_TODAY',
      error: 'Brownie : épuisé aujourd’hui.',
      soldOutLines: [{ cartId: 'n1' }],
    });
  });

  it('rassure sur une erreur serveur ou réseau : rien n’a été modifié', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      json({ code: 'SERVER_ERROR', error: 'Erreur serveur' }, 500)
    );
    const server = await cancelOrder('o1');
    expect(server.ok).toBe(false);
    if (!server.ok) expect(server.error).toMatch(/rien n’a été modifié/);

    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('offline'));
    const network = await cancelOrder('o1');
    if (!network.ok) expect(network.error).toMatch(/connexion/);
  });
});
