import { describe, it, expect } from 'vitest';
import { generatePickupSlots } from './pickup-slots';

describe('generatePickupSlots', () => {
  it('retourne des créneaux dans la plage 07h30–21h30 (défaut aligné brand)', () => {
    const now = new Date(2026, 4, 10, 6, 0, 0); // 06:00 local
    const slots = generatePickupSlots(now);

    expect(slots.length).toBeGreaterThan(0);
    for (const slot of slots) {
      const totalMinutes = slot.getHours() * 60 + slot.getMinutes();
      expect(totalMinutes).toBeGreaterThanOrEqual(7 * 60 + 30);
      expect(totalMinutes).toBeLessThanOrEqual(21 * 60 + 30);
    }
  });

  it('ne retourne pas de créneaux dans les 30 prochaines minutes', () => {
    const now = new Date(2026, 4, 10, 9, 0, 0); // 09:00 local
    const minAllowed = new Date(now.getTime() + 30 * 60 * 1000); // 09:30

    const slots = generatePickupSlots(now);

    for (const slot of slots) {
      expect(slot.getTime()).toBeGreaterThanOrEqual(minAllowed.getTime());
    }
  });

  it('retourne des créneaux à intervalles de 15 min', () => {
    const now = new Date(2026, 4, 10, 7, 0, 0);

    const slots = generatePickupSlots(now);
    const today = new Date(2026, 4, 10, 0, 0, 0);
    const todaySlots = slots.filter((s) => {
      const d = new Date(s.getFullYear(), s.getMonth(), s.getDate());
      return d.getTime() === today.getTime();
    });

    for (let i = 1; i < todaySlots.length; i++) {
      const diff =
        (todaySlots[i].getTime() - todaySlots[i - 1].getTime()) / 60000;
      expect(diff).toBe(15);
    }
  });

  it("inclut des créneaux pour aujourd'hui et demain", () => {
    const now = new Date(2026, 4, 10, 7, 0, 0);

    const slots = generatePickupSlots(now);

    const today = new Date(2026, 4, 10, 0, 0, 0);
    const tomorrow = new Date(2026, 4, 11, 0, 0, 0);

    const hasToday = slots.some((s) => {
      const d = new Date(s.getFullYear(), s.getMonth(), s.getDate());
      return d.getTime() === today.getTime();
    });
    const hasTomorrow = slots.some((s) => {
      const d = new Date(s.getFullYear(), s.getMonth(), s.getDate());
      return d.getTime() === tomorrow.getTime();
    });

    expect(hasToday).toBe(true);
    expect(hasTomorrow).toBe(true);
  });

  it('retourne uniquement des créneaux demain si now est après 21h00', () => {
    // Dernier créneau du jour : 21h30 ; lead time 30 min → après 21h00, plus
    // rien aujourd'hui.
    const now = new Date(2026, 4, 10, 21, 1, 0);
    const today = new Date(2026, 4, 10, 0, 0, 0);
    const tomorrow = new Date(2026, 4, 11, 0, 0, 0);

    const slots = generatePickupSlots(now);

    const todaySlots = slots.filter((s) => {
      const d = new Date(s.getFullYear(), s.getMonth(), s.getDate());
      return d.getTime() === today.getTime();
    });
    const tomorrowSlots = slots.filter((s) => {
      const d = new Date(s.getFullYear(), s.getMonth(), s.getDate());
      return d.getTime() === tomorrow.getTime();
    });

    expect(todaySlots.length).toBe(0);
    expect(tomorrowSlots.length).toBeGreaterThan(0);
  });

  it('exclut le créneau à exactement 30 min si now a des secondes non nulles', () => {
    // now = 09:00:01.500 → minTime = 09:30:01.500 → le créneau 09:30:00.000 est exclu
    const now = new Date(2026, 4, 10, 9, 0, 1, 500);
    const slots = generatePickupSlots(now);

    const todaySlots = slots.filter((s) => {
      const d = new Date(s.getFullYear(), s.getMonth(), s.getDate());
      return d.getTime() === new Date(2026, 4, 10, 0, 0, 0).getTime();
    });

    // 09:30 is exactly at 09:00:01.5 + 30min = 09:30:01.5 → 09:30:00.000 < 09:30:01.500 → excluded
    const has930 = todaySlots.some(
      (s) => s.getHours() === 9 && s.getMinutes() === 30
    );
    expect(has930).toBe(false);
    // 09:45 should be included (45 min after now)
    const has945 = todaySlots.some(
      (s) => s.getHours() === 9 && s.getMinutes() === 45
    );
    expect(has945).toBe(true);
  });
});
