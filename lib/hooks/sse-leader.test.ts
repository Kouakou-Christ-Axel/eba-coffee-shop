// lib/hooks/sse-leader.test.ts
//
// Teste uniquement `hasWebLocksSupport`, la fonction pure de détection de
// support navigateur. Le reste de `startSseLeader` (élection de leader,
// bascule à la fermeture d'un onglet) s'appuie sur `navigator.locks` et
// `BroadcastChannel` réels — non simulables sans jsdom (absent de ce repo,
// cf. `use-checkout-form.test.ts`) ; leur vérification reste manuelle
// (checklist multi-onglets, voir le plan de la PR).

import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasWebLocksSupport } from './sse-leader';

describe('hasWebLocksSupport', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('retourne false quand `navigator` est absent', () => {
    vi.stubGlobal('navigator', undefined);
    expect(hasWebLocksSupport()).toBe(false);
  });

  it('retourne false quand `navigator.locks` est absent', () => {
    vi.stubGlobal('navigator', {});
    expect(hasWebLocksSupport()).toBe(false);
  });

  it('retourne true quand `navigator.locks` est présent', () => {
    vi.stubGlobal('navigator', { locks: { request: vi.fn() } });
    expect(hasWebLocksSupport()).toBe(true);
  });
});
