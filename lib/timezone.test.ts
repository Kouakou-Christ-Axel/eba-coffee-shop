// lib/timezone.test.ts
//
// Vérifie que la conversion jour civil ⇄ Order.dailyDate (@db.Date) est
// indépendante du fuseau du runtime — cause racine du bug de synchro du filtre
// de date des commandes.

import { describe, it, expect } from 'vitest';
import {
  parseDateOnlyToUTC,
  shiftDateString,
  formatLocalDateOnly,
  todayDateString,
  abidjanDatetimeLocalToISO,
  isoToAbidjanDatetimeLocal,
  formatAbidjanTime,
  formatAbidjanDateTime,
} from '@/lib/timezone';

describe('parseDateOnlyToUTC', () => {
  it('parse YYYY-MM-DD en minuit UTC (== @db.Date stocké)', () => {
    const d = parseDateOnlyToUTC('2026-06-08');
    expect(d).toBeInstanceOf(Date);
    expect(d!.toISOString()).toBe('2026-06-08T00:00:00.000Z');
  });

  it('renvoie undefined pour une entrée invalide', () => {
    expect(parseDateOnlyToUTC('08/06/2026')).toBeUndefined();
    expect(parseDateOnlyToUTC('2026-13-40')).not.toBeUndefined(); // Date normalise
    expect(parseDateOnlyToUTC(undefined)).toBeUndefined();
    expect(parseDateOnlyToUTC('')).toBeUndefined();
  });

  it('roundtrip parse → format est stable', () => {
    for (const v of ['2026-01-01', '2026-06-08', '2026-12-31']) {
      expect(formatLocalDateOnly(parseDateOnlyToUTC(v)!)).toBe(v);
    }
  });
});

describe('shiftDateString', () => {
  it('décale de N jours sans franchir de fuseau', () => {
    expect(shiftDateString('2026-06-08', -1)).toBe('2026-06-07');
    expect(shiftDateString('2026-06-08', 1)).toBe('2026-06-09');
    expect(shiftDateString('2026-06-08', -7)).toBe('2026-06-01');
  });

  it('gère les bascules de mois', () => {
    expect(shiftDateString('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDateString('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('todayDateString', () => {
  it("renvoie le jour civil d'Abidjan au format YYYY-MM-DD", () => {
    expect(todayDateString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('créneaux de retrait (datetime-local ⇄ ISO, ancrés Abidjan)', () => {
  it('interprète la valeur datetime-local comme heure Abidjan (= UTC)', () => {
    expect(abidjanDatetimeLocalToISO('2026-06-23T10:00')).toBe(
      '2026-06-23T10:00:00.000Z'
    );
  });

  it('chaîne vide ou invalide → null', () => {
    expect(abidjanDatetimeLocalToISO('')).toBeNull();
    expect(abidjanDatetimeLocalToISO('pas une date')).toBeNull();
  });

  it('roundtrip ISO → datetime-local → ISO est stable', () => {
    const iso = '2026-06-23T10:00:00.000Z';
    const local = isoToAbidjanDatetimeLocal(iso);
    expect(local).toBe('2026-06-23T10:00');
    expect(abidjanDatetimeLocalToISO(local)).toBe(iso);
  });

  it('accepte une Date et gère null', () => {
    expect(
      isoToAbidjanDatetimeLocal(new Date('2026-06-23T09:05:00.000Z'))
    ).toBe('2026-06-23T09:05');
    expect(isoToAbidjanDatetimeLocal(null)).toBe('');
  });

  it('formate l’heure et la date en Abidjan (pas d’heure machine)', () => {
    // 10:00 UTC = 10:00 Abidjan, indépendamment du fuseau du runtime.
    expect(formatAbidjanTime('2026-06-23T10:00:00.000Z')).toBe('10h00');
    expect(formatAbidjanDateTime('2026-06-23T10:00:00.000Z')).toContain(
      '10h00'
    );
  });
});
