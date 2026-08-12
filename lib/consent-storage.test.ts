// lib/consent-storage.test.ts
//
// Persistance du consentement cookies : lecture tolérante aux données
// corrompues et aux versions périmées. Toute anomalie doit retomber sur
// 'pending' — re-solliciter le visiteur est le seul repli acceptable, ne rien
// mesurer par erreur valant toujours mieux que mesurer sans accord.
// localStorage est simulé (environnement node, pas de jsdom) — même patron
// que lib/order-history.test.ts.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
  clearConsent,
  readConsent,
  readConsentStatus,
  writeConsent,
} from './consent-storage';

function installLocalStorage() {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  (globalThis as Record<string, unknown>).window = { localStorage };
  return store;
}

describe('consent-storage', () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = installLocalStorage();
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).window;
  });

  it("renvoie 'pending' sans choix stocké", () => {
    expect(readConsent()).toBeNull();
    expect(readConsentStatus()).toBe('pending');
  });

  it('écrit puis relit une acceptation', () => {
    writeConsent(true);
    expect(readConsent()).toMatchObject({
      version: CONSENT_VERSION,
      analytics: true,
      ads: true,
    });
    expect(readConsentStatus()).toBe('granted');
  });

  it('écrit puis relit un refus', () => {
    writeConsent(false);
    expect(readConsent()).toMatchObject({ analytics: false, ads: false });
    expect(readConsentStatus()).toBe('denied');
  });

  it('horodate le choix (preuve de recueil)', () => {
    const before = Date.now();
    const record = writeConsent(true);
    expect(record.ts).toBeGreaterThanOrEqual(before);
  });

  it("retombe sur 'pending' sur un JSON corrompu", () => {
    store.set(CONSENT_STORAGE_KEY, '{pas du json');
    expect(readConsentStatus()).toBe('pending');
  });

  it("retombe sur 'pending' sur un JSON valide mais non-objet", () => {
    store.set(CONSENT_STORAGE_KEY, '"accepté"');
    expect(readConsentStatus()).toBe('pending');
  });

  it("retombe sur 'pending' si la version a changé (politique révisée)", () => {
    store.set(
      CONSENT_STORAGE_KEY,
      JSON.stringify({ version: CONSENT_VERSION - 1, analytics: true, ts: 1 })
    );
    expect(readConsentStatus()).toBe('pending');
  });

  it("retombe sur 'pending' si `analytics` n'est pas un booléen", () => {
    store.set(
      CONSENT_STORAGE_KEY,
      JSON.stringify({ version: CONSENT_VERSION, analytics: 'oui', ts: 1 })
    );
    expect(readConsentStatus()).toBe('pending');
  });

  it('aligne `ads` sur `analytics` quand le champ manque (ancien format)', () => {
    store.set(
      CONSENT_STORAGE_KEY,
      JSON.stringify({ version: CONSENT_VERSION, analytics: true, ts: 1 })
    );
    expect(readConsent()).toMatchObject({ analytics: true, ads: true });
  });

  it('efface le choix', () => {
    writeConsent(true);
    clearConsent();
    expect(readConsentStatus()).toBe('pending');
  });

  it('ne lève pas si localStorage est indisponible (navigation privée)', () => {
    (globalThis as Record<string, unknown>).window = {
      localStorage: {
        getItem: () => {
          throw new Error('SecurityError');
        },
        setItem: () => {
          throw new Error('SecurityError');
        },
        removeItem: () => {
          throw new Error('SecurityError');
        },
      },
    };
    expect(() => writeConsent(true)).not.toThrow();
    expect(() => clearConsent()).not.toThrow();
    expect(readConsentStatus()).toBe('pending');
  });
});
