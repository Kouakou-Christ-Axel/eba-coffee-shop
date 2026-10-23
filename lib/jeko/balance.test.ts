import { describe, expect, it, vi } from 'vitest';
import {
  extractBalanceCents,
  fetchRemoteBalance,
  getJekoStoreBalance,
} from './balance';

const config = { apiKey: 'k', apiKeyId: 'i', storeId: 'store 1' };
const reply = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe('extractBalanceCents', () => {
  it.each([
    [{ balance: 150000 }, 150000],
    [{ balance: { amount: 150000, currency: 'XOF' } }, 150000],
    [{ availableBalance: { amount: 42, currency: 'XOF' } }, 42],
    [{ amountCents: 900 }, 900],
  ])('lit %j', (body, cents) => {
    expect(extractBalanceCents(body)).toBe(cents);
  });

  it('renvoie null quand rien ne ressemble à un montant', () => {
    expect(extractBalanceCents({ foo: 'bar' })).toBeNull();
    expect(extractBalanceCents(null)).toBeNull();
  });
});

describe('getJekoStoreBalance', () => {
  it('appelle la route du magasin avec les en-têtes et convertit les centimes', async () => {
    const fetchFn = reply({ balance: { amount: 25000000, currency: 'XOF' } });

    await expect(
      getJekoStoreBalance(config, fetchFn as never)
    ).resolves.toEqual({ kind: 'ok', balanceFcfa: 250000 });

    const [url, init] = fetchFn.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      'https://api.jeko.africa/partner_api/stores/store%201/balance'
    );
    expect(init.headers).toMatchObject({
      'X-API-KEY': 'k',
      'X-API-KEY-ID': 'i',
    });
  });

  it('remonte le JSON brut quand la forme est inconnue', async () => {
    await expect(
      getJekoStoreBalance(config, reply({ foo: 1 }) as never)
    ).resolves.toEqual({ kind: 'unknown', raw: '{"foo":1}' });
  });
});

describe('fetchRemoteBalance', () => {
  it('ne lève jamais : config absente ou panne Jèko deviennent un état affichable', async () => {
    await expect(fetchRemoteBalance(null)).resolves.toEqual({
      kind: 'unconfigured',
    });
    vi.stubGlobal('fetch', reply({ message: 'non' }, 401));
    await expect(fetchRemoteBalance(config)).resolves.toMatchObject({
      kind: 'error',
    });
    vi.unstubAllGlobals();
  });
});
