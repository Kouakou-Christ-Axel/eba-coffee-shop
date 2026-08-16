// lib/pickup-settings.test.ts
import { describe, it, expect } from 'vitest';
import { summarizeOpenDays } from './pickup-settings';
import type { WeeklyHours } from './pickup-settings';

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
