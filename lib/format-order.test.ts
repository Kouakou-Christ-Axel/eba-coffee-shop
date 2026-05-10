import { describe, it, expect } from 'vitest';
import { formatPickupTime } from './format-order';

describe('formatPickupTime', () => {
  it('formate en "Jour JJ mois · HHhMM" en français', () => {
    const date = new Date('2026-05-10T14:30:00');
    const result = formatPickupTime(date);
    // Doit correspondre au pattern : "Dimanche 10 mai · 14h30"
    expect(result).toMatch(/^[A-Z][a-z]+ \d{1,2} [a-z]+ · \d{2}h\d{2}$/);
  });

  it('capitalise la première lettre du nom du jour', () => {
    const date = new Date('2026-05-10T08:00:00');
    const result = formatPickupTime(date);
    expect(result[0]).toBe(result[0].toUpperCase());
    expect(result[1]).toBe(result[1].toLowerCase());
  });

  it('inclut le bon jour du mois', () => {
    const date = new Date('2026-05-10T14:30:00');
    const result = formatPickupTime(date);
    expect(result).toMatch(/ 10 /);
  });

  it('inclut "mai" pour le mois 5', () => {
    const date = new Date('2026-05-10T14:30:00');
    const result = formatPickupTime(date);
    expect(result).toContain('mai');
  });

  it('formate les heures et minutes à 2 chiffres', () => {
    const date = new Date('2026-05-10T09:00:00');
    const result = formatPickupTime(date);
    expect(result).toContain('09h00');
  });

  it('inclut le séparateur "·"', () => {
    const date = new Date('2026-05-10T14:30:00');
    const result = formatPickupTime(date);
    expect(result).toContain('·');
  });
});
