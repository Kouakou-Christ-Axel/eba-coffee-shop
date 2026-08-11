import { describe, expect, it, vi } from 'vitest';
import { coalesceAsync } from './async-coalesce';

// Résout au prochain tick microtask, pour simuler un fetch async réaliste
// sans dépendre de timers réels.
function deferred<T>(value: T) {
  return new Promise<T>((resolve) => queueMicrotask(() => resolve(value)));
}

describe('coalesceAsync', () => {
  it('partage la même promesse entre appels concurrents (un seul appel réel à fn)', async () => {
    const fn = vi.fn(() => deferred('résultat'));
    const shared = coalesceAsync(fn);

    // Trois appels lancés AVANT résolution du premier.
    const [a, b, c] = [shared(), shared(), shared()];
    expect(fn).toHaveBeenCalledTimes(1);

    const results = await Promise.all([a, b, c]);
    expect(results).toEqual(['résultat', 'résultat', 'résultat']);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('relance fn pour un appel POSTÉRIEUR à la résolution (pas de TTL/cache figé)', async () => {
    let n = 0;
    const fn = vi.fn(() => deferred(++n));
    const shared = coalesceAsync(fn);

    const first = await shared();
    const second = await shared();

    expect(first).toBe(1);
    expect(second).toBe(2);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('propage un rejet à tous les appelants concurrents puis libère l’état en vol', async () => {
    let n = 0;
    const fn = vi.fn(() =>
      n++ === 0
        ? Promise.reject(new Error('échec temporaire'))
        : deferred('ok')
    );
    const shared = coalesceAsync(fn);

    const a = shared();
    const b = shared();
    await expect(a).rejects.toThrow('échec temporaire');
    await expect(b).rejects.toThrow('échec temporaire');
    expect(fn).toHaveBeenCalledTimes(1);

    // Après l'échec, un nouvel appel doit retenter (pas bloqué indéfiniment).
    await expect(shared()).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('des vagues d’appels non chevauchantes déclenchent chacune un appel distinct', async () => {
    const fn = vi.fn(() => deferred(undefined));
    const shared = coalesceAsync(fn);

    await shared();
    await shared();
    await shared();

    expect(fn).toHaveBeenCalledTimes(3);
  });
});
