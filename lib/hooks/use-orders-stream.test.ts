// lib/hooks/use-orders-stream.test.ts
//
// Tests du helper pur exporté par `use-orders-stream.ts`. Le hook lui-même
// (connexion `EventSource`, timers) n'est pas testable sans jsdom/renderHook
// (non installés dans ce repo, cf. `use-checkout-form.test.ts`) — on vérifie
// donc directement `computeIsStale`, la fonction pure qui décide du bandeau
// de déconnexion prolongée.

import { describe, expect, it } from 'vitest';
import { computeIsStale, DEFAULT_STALE_AFTER_MS } from './use-orders-stream';

describe('computeIsStale', () => {
  it('retourne false quand jamais déconnecté (disconnectedSinceMs === null)', () => {
    expect(computeIsStale(null, 1_000_000)).toBe(false);
  });

  it('retourne false sous le seuil', () => {
    const disconnectedSince = 1_000_000;
    const now = disconnectedSince + DEFAULT_STALE_AFTER_MS - 1;
    expect(computeIsStale(disconnectedSince, now)).toBe(false);
  });

  it('retourne true au-dessus du seuil', () => {
    const disconnectedSince = 1_000_000;
    const now = disconnectedSince + DEFAULT_STALE_AFTER_MS + 1;
    expect(computeIsStale(disconnectedSince, now)).toBe(true);
  });

  it('retourne true à l’égalité exacte du seuil (comparaison >=)', () => {
    const disconnectedSince = 1_000_000;
    const now = disconnectedSince + DEFAULT_STALE_AFTER_MS;
    expect(computeIsStale(disconnectedSince, now)).toBe(true);
  });

  it('respecte un seuil personnalisé', () => {
    const disconnectedSince = 1_000_000;
    expect(
      computeIsStale(disconnectedSince, disconnectedSince + 5_000, 10_000)
    ).toBe(false);
    expect(
      computeIsStale(disconnectedSince, disconnectedSince + 10_000, 10_000)
    ).toBe(true);
  });
});
