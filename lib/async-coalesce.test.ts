import { describe, expect, it } from 'vitest';
import { coalesceAsyncByKey } from './async-coalesce';

/** Promesse dont on contrôle la résolution depuis le test. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('coalesceAsyncByKey', () => {
  it('partage une seule exécution entre appels de même clé', async () => {
    let calls = 0;
    const d = deferred<string>();
    const shared = coalesceAsyncByKey(
      () => {
        calls++;
        return d.promise;
      },
      () => 1
    );

    const a = shared();
    const b = shared();
    const c = shared();
    expect(calls).toBe(1);

    d.resolve('file');
    await expect(Promise.all([a, b, c])).resolves.toEqual([
      'file',
      'file',
      'file',
    ]);
  });

  it('relance un calcul frais quand la clé a changé, MÊME si un calcul est en vol', async () => {
    // C'est la propriété critique. Partager naïvement toute promesse en vol
    // ferait qu'un client réveillé par une commande arrivée APRÈS le début du
    // calcul recevrait un instantané antérieur à cette commande — qui
    // n'apparaîtrait alors jamais en caisse.
    let calls = 0;
    const pending: ReturnType<typeof deferred<number>>[] = [];
    let generation = 1;
    const shared = coalesceAsyncByKey(
      () => {
        calls++;
        const d = deferred<number>();
        pending.push(d);
        return d.promise;
      },
      () => generation
    );

    const first = shared(); // génération 1
    expect(calls).toBe(1);

    generation = 2; // une nouvelle commande est arrivée entre-temps
    const second = shared(); // le calcul de la génération 1 tourne toujours
    expect(calls).toBe(2);

    pending[0]!.resolve(1);
    pending[1]!.resolve(2);
    await expect(first).resolves.toBe(1);
    await expect(second).resolves.toBe(2);
  });

  it('relance après résolution (aucune mémorisation, pas de TTL)', async () => {
    let calls = 0;
    const shared = coalesceAsyncByKey(
      () => {
        calls++;
        return Promise.resolve(calls);
      },
      () => 1
    );

    await expect(shared()).resolves.toBe(1);
    await expect(shared()).resolves.toBe(2);
    expect(calls).toBe(2);
  });

  it('libère l’état en vol après un échec', async () => {
    let calls = 0;
    const shared = coalesceAsyncByKey(
      () => {
        calls++;
        return calls === 1
          ? Promise.reject(new Error('DB injoignable'))
          : Promise.resolve('ok');
      },
      () => 1
    );

    await expect(shared()).rejects.toThrow('DB injoignable');
    // Un échec ne doit pas figer la file : l'appel suivant retente.
    await expect(shared()).resolves.toBe('ok');
  });

  it('propage l’échec à tous les appels partagés', async () => {
    const d = deferred<string>();
    const shared = coalesceAsyncByKey(
      () => d.promise,
      () => 1
    );

    const a = shared();
    const b = shared();
    d.reject(new Error('boum'));

    await expect(a).rejects.toThrow('boum');
    await expect(b).rejects.toThrow('boum');
  });
});
