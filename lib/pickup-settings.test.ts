// lib/pickup-settings.test.ts
import { describe, it, expect } from 'vitest';
import {
  summarizeOpenDays,
  extendClosingToday,
  DEFAULT_SETTINGS,
} from './pickup-settings';
import type { WeeklyHours, PickupSettings } from './pickup-settings';

const RANGE = [{ start: '08:30', end: '19:00' }];

/** `weeklyHours` ouvert les seuls jours listés (clés `getDay()`). */
function openOn(...days: string[]): WeeklyHours {
  const week: WeeklyHours = {
    '0': [],
    '1': [],
    '2': [],
    '3': [],
    '4': [],
    '5': [],
    '6': [],
  };
  for (const day of days) week[day] = RANGE;
  return week;
}

describe('summarizeOpenDays', () => {
  it('résume les horaires réels du commerce (lundi fermé)', () => {
    expect(summarizeOpenDays(openOn('2', '3', '4', '5', '6', '0'))).toBe(
      'Ouvert du mardi au dimanche'
    );
  });

  it('reconnaît une semaine complète', () => {
    expect(summarizeOpenDays(openOn('1', '2', '3', '4', '5', '6', '0'))).toBe(
      'Ouvert 7j/7'
    );
  });

  it('énumère les jours quand ils ne se suivent pas', () => {
    expect(summarizeOpenDays(openOn('2', '4', '6'))).toBe(
      'Ouvert le mardi, jeudi et samedi'
    );
  });

  it('gère un jour unique', () => {
    expect(summarizeOpenDays(openOn('6'))).toBe('Ouvert le samedi');
  });

  it("renvoie une chaîne vide si rien n'est ouvert, pour que l'appelant omette la phrase", () => {
    expect(summarizeOpenDays(openOn())).toBe('');
  });

  it('compte la semaine du lundi au dimanche, pas du dimanche au samedi', () => {
    // `WEEK_ORDER` démarre au lundi : dimanche est le dernier jour, donc
    // « lundi → dimanche » est contigu et « dimanche → lundi » ne l'est pas.
    expect(summarizeOpenDays(openOn('1', '2', '3', '4', '5'))).toBe(
      'Ouvert du lundi au vendredi'
    );
    expect(summarizeOpenDays(openOn('0', '1'))).toBe(
      'Ouvert le lundi et dimanche'
    );
  });

  it('reste court pour tenir dans une meta description', () => {
    expect(
      summarizeOpenDays(openOn('2', '3', '4', '5', '6', '0')).length
    ).toBeLessThan(40);
  });
});

describe('extendClosingToday', () => {
  const today = new Date(2026, 0, 5); // date arbitraire, fixe pour le test
  const weekday = String(today.getDay());
  const todayKey = '2026-01-05';

  function baseSettings(overrides: Partial<PickupSettings> = {}) {
    return {
      ...DEFAULT_SETTINGS,
      weeklyHours: { ...DEFAULT_SETTINGS.weeklyHours, [weekday]: RANGE },
      dateOverrides: [],
      ...overrides,
    };
  }

  it('repousse la fin du dernier créneau des horaires hebdomadaires', () => {
    const next = extendClosingToday(baseSettings(), 60, today);
    expect(next.dateOverrides).toEqual([
      {
        date: todayKey,
        closed: false,
        ranges: [{ start: '08:30', end: '20:00' }],
      },
    ]);
    // Les horaires hebdo restent inchangés : seule une exception de date est ajoutée.
    expect(next.weeklyHours[weekday]).toEqual(RANGE);
  });

  it("étend le dernier créneau d'un override déjà présent pour aujourd'hui, au lieu de repartir des horaires hebdo", () => {
    const settings = baseSettings({
      dateOverrides: [
        {
          date: todayKey,
          closed: false,
          ranges: [{ start: '09:00', end: '21:30' }],
        },
      ],
    });
    const next = extendClosingToday(settings, 90, today);
    expect(next.dateOverrides).toEqual([
      {
        date: todayKey,
        closed: false,
        ranges: [{ start: '09:00', end: '23:00' }],
      },
    ]);
  });

  it('étend uniquement le dernier créneau quand plusieurs plages existent', () => {
    const settings = baseSettings({
      weeklyHours: {
        ...DEFAULT_SETTINGS.weeklyHours,
        [weekday]: [
          { start: '07:00', end: '10:00' },
          { start: '11:00', end: '14:00' },
        ],
      },
    });
    const next = extendClosingToday(settings, 30, today);
    expect(next.dateOverrides[0].ranges).toEqual([
      { start: '07:00', end: '10:00' },
      { start: '11:00', end: '14:30' },
    ]);
  });

  it('plafonne à 23:59', () => {
    const settings = baseSettings({
      weeklyHours: {
        ...DEFAULT_SETTINGS.weeklyHours,
        [weekday]: [{ start: '08:00', end: '23:30' }],
      },
    });
    const next = extendClosingToday(settings, 120, today);
    expect(next.dateOverrides[0].ranges).toEqual([
      { start: '08:00', end: '23:59' },
    ]);
  });

  it("refuse de repousser la fermeture d'un jour marqué fermé", () => {
    const settings = baseSettings({
      dateOverrides: [{ date: todayKey, closed: true, ranges: [] }],
    });
    expect(() => extendClosingToday(settings, 60, today)).toThrow(
      /marqué fermé/
    );
  });
});
