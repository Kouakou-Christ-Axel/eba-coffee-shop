import { describe, it, expect, vi, afterEach } from 'vitest';
import { submitNewOrder } from './submit';

function handlers() {
  return { onCreated: vi.fn(), onShortage: vi.fn(), onError: vi.fn() };
}

function mockFetch(impl: () => Promise<Response> | Response) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => impl())
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('submitNewOrder', () => {
  it('envoie le payload en POST JSON', async () => {
    mockFetch(() => Response.json({ dailyNumber: 7 }));
    await submitNewOrder({ items: [] }, handlers());
    expect(fetch).toHaveBeenCalledWith(
      '/api/caisse/orders',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ items: [] }),
      })
    );
  });

  it('transmet le n° du jour à onCreated', async () => {
    mockFetch(() => Response.json({ dailyNumber: 12 }));
    const h = handlers();
    await submitNewOrder({}, h);
    expect(h.onCreated).toHaveBeenCalledWith(12);
  });

  it('crée quand même si la réponse est illisible (n° null)', async () => {
    mockFetch(() => new Response('pas du json', { status: 201 }));
    const h = handlers();
    await submitNewOrder({}, h);
    expect(h.onCreated).toHaveBeenCalledWith(null);
    expect(h.onError).not.toHaveBeenCalled();
  });

  it('409 avec pénurie : appelle onShortage', async () => {
    const shortage = [{ name: 'Choux' }];
    mockFetch(() =>
      Response.json({ error: 'Stock', shortage }, { status: 409 })
    );
    const h = handlers();
    await submitNewOrder({}, h);
    expect(h.onShortage).toHaveBeenCalledWith(shortage);
    expect(h.onCreated).not.toHaveBeenCalled();
  });

  it('409 sans pénurie : message de l’API', async () => {
    mockFetch(() => Response.json({ error: 'Déjà payée' }, { status: 409 }));
    const h = handlers();
    await submitNewOrder({}, h);
    expect(h.onError).toHaveBeenCalledWith('Déjà payée');
  });

  it('409 illisible : « Erreur 409 »', async () => {
    mockFetch(() => new Response('x', { status: 409 }));
    const h = handlers();
    await submitNewOrder({}, h);
    expect(h.onError).toHaveBeenCalledWith('Erreur 409');
  });

  it('autre erreur HTTP : message extrait de la réponse', async () => {
    mockFetch(() =>
      Response.json({ error: 'Champ invalide' }, { status: 400 })
    );
    const h = handlers();
    await submitNewOrder({}, h);
    expect(h.onError).toHaveBeenCalledWith('Champ invalide');
  });

  it('erreur réseau : message de l’erreur, ou « Erreur réseau » sinon', async () => {
    mockFetch(() => Promise.reject(new Error('Failed to fetch')));
    const a = handlers();
    await submitNewOrder({}, a);
    expect(a.onError).toHaveBeenCalledWith('Failed to fetch');

    mockFetch(() => Promise.reject('boom'));
    const b = handlers();
    await submitNewOrder({}, b);
    expect(b.onError).toHaveBeenCalledWith('Erreur réseau');
  });

  it('si onCreated lève, l’erreur est remontée via onError', async () => {
    mockFetch(() => Response.json({ dailyNumber: 1 }));
    const h = handlers();
    h.onCreated.mockImplementation(() => {
      throw new Error('navigation impossible');
    });
    await submitNewOrder({}, h);
    expect(h.onError).toHaveBeenCalledWith('navigation impossible');
  });
});
