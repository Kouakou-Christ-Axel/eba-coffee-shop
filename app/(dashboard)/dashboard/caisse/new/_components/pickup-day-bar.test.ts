import { describe, it, expect } from 'vitest';
import { resolvePickupChip } from './pickup-day-bar';
import { shiftDateString, todayDateString } from '@/lib/timezone';

// La puce active est DÉRIVÉE de `pickupTime`, jamais stockée à côté : un état
// parallèle finirait par mentir sur ce qui est réellement soumis.
describe('resolvePickupChip', () => {
  const today = todayDateString();

  it('sans créneau, c’est un walk-in : « Maintenant »', () => {
    expect(resolvePickupChip(null)).toBe('now');
  });

  it('un créneau du jour reste « Plus tard aujourd’hui »', () => {
    expect(resolvePickupChip(`${today}T18:00:00.000Z`)).toBe('today-later');
  });

  it('le lendemain est reconnu comme « Demain »', () => {
    expect(resolvePickupChip(`${shiftDateString(today, 1)}T11:00:00.000Z`)).toBe(
      'tomorrow'
    );
  });

  it('au-delà, c’est « Autre date »', () => {
    expect(resolvePickupChip(`${shiftDateString(today, 4)}T11:00:00.000Z`)).toBe(
      'other'
    );
  });
});
