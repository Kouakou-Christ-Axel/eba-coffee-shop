import { describe, it, expect } from 'vitest';
import {
  generatePickupSlots,
  pickDefaultSlot,
  pickOpenDayTime,
} from './pickup-slots';

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

// ─── Créneau par défaut d'une commande contrainte à un jour ultérieur ────────
//
// Le client dont le panier contient un article épuisé arrive au checkout avec
// le créneau déjà posé. Encore faut-il que ce créneau EXISTE : 11:00 peut
// tomber en dehors des horaires, du pas de créneau, ou d'un jour fermé.

describe('pickDefaultSlot', () => {
  const at = (iso: string) => new Date(iso);

  it('retient l’heure exacte quand elle est proposée', () => {
    const slots = [
      at('2026-06-14T10:45:00.000Z'),
      at('2026-06-14T11:00:00.000Z'),
      at('2026-06-14T11:15:00.000Z'),
    ];
    expect(pickDefaultSlot(slots, '2026-06-14', '11:00')?.toISOString()).toBe(
      '2026-06-14T11:00:00.000Z'
    );
  });

  it('prend le créneau suivant quand l’heure exacte n’existe pas', () => {
    // On ne fait jamais venir le client PLUS TÔT que l'heure proposée.
    const slots = [
      at('2026-06-14T10:50:00.000Z'),
      at('2026-06-14T11:20:00.000Z'),
    ];
    expect(pickDefaultSlot(slots, '2026-06-14', '11:00')?.toISOString()).toBe(
      '2026-06-14T11:20:00.000Z'
    );
  });

  it('retombe sur le créneau le plus proche AVANT si le jour se termine plus tôt', () => {
    const slots = [
      at('2026-06-14T08:00:00.000Z'),
      at('2026-06-14T09:30:00.000Z'),
    ];
    expect(pickDefaultSlot(slots, '2026-06-14', '11:00')?.toISOString()).toBe(
      '2026-06-14T09:30:00.000Z'
    );
  });

  it('passe au jour suivant quand le jour demandé n’offre aucun créneau (fermé)', () => {
    const slots = [at('2026-06-15T11:00:00.000Z')];
    expect(pickDefaultSlot(slots, '2026-06-14', '11:00')?.toISOString()).toBe(
      '2026-06-15T11:00:00.000Z'
    );
  });

  it('ignore les créneaux antérieurs au jour minimum', () => {
    const slots = [
      at('2026-06-13T11:00:00.000Z'),
      at('2026-06-14T11:00:00.000Z'),
    ];
    expect(pickDefaultSlot(slots, '2026-06-14', '11:00')?.toISOString()).toBe(
      '2026-06-14T11:00:00.000Z'
    );
  });

  it('renvoie null quand aucun créneau n’est disponible', () => {
    expect(pickDefaultSlot([], '2026-06-14', '11:00')).toBeNull();
    expect(
      pickDefaultSlot([at('2026-06-10T11:00:00.000Z')], '2026-06-14', '11:00')
    ).toBeNull();
  });
});

// ─── pickOpenDayTime : le raccourci ne propose jamais un jour fermé ───────────

describe('pickOpenDayTime', () => {
  const OPEN = [{ start: '07:30', end: '21:30' }];
  const AFTERNOON = [{ start: '14:00', end: '20:00' }];
  const MORNING = [{ start: '07:00', end: '10:00' }];
  const SPLIT = [
    { start: '07:00', end: '10:00' },
    { start: '14:00', end: '20:00' },
  ];

  it('garde l’heure voulue quand une plage la contient', () => {
    const days = [{ date: '2026-06-14', ranges: OPEN }];
    expect(pickOpenDayTime(days, '2026-06-14', '11:00')).toEqual({
      date: '2026-06-14',
      time: '11:00',
    });
  });

  it('recale à l’ouverture quand le commerce ouvre plus tard', () => {
    const days = [{ date: '2026-06-14', ranges: AFTERNOON }];
    expect(pickOpenDayTime(days, '2026-06-14', '11:00')).toEqual({
      date: '2026-06-14',
      time: '14:00',
    });
  });

  it('retombe sur la fermeture quand l’heure voulue est déjà passée', () => {
    const days = [{ date: '2026-06-14', ranges: MORNING }];
    expect(pickOpenDayTime(days, '2026-06-14', '11:00')).toEqual({
      date: '2026-06-14',
      time: '10:00',
    });
  });

  it('vise la plage de l’après-midi sur une journée à coupure méridienne', () => {
    const days = [{ date: '2026-06-14', ranges: SPLIT }];
    expect(pickOpenDayTime(days, '2026-06-14', '11:00')).toEqual({
      date: '2026-06-14',
      time: '14:00',
    });
  });

  it('saute un jour fermé (aucune plage) — le cœur de la demande', () => {
    const days = [
      { date: '2026-06-14', ranges: [] },
      { date: '2026-06-15', ranges: OPEN },
    ];
    expect(pickOpenDayTime(days, '2026-06-14', '11:00')).toEqual({
      date: '2026-06-15',
      time: '11:00',
    });
  });

  it('saute plusieurs jours fermés d’affilée', () => {
    const days = [
      { date: '2026-06-14', ranges: [] },
      { date: '2026-06-15', ranges: [] },
      { date: '2026-06-16', ranges: AFTERNOON },
    ];
    expect(pickOpenDayTime(days, '2026-06-14', '11:00')).toEqual({
      date: '2026-06-16',
      time: '14:00',
    });
  });

  it('ignore les jours antérieurs au jour demandé', () => {
    const days = [
      { date: '2026-06-13', ranges: OPEN },
      { date: '2026-06-14', ranges: OPEN },
    ];
    expect(pickOpenDayTime(days, '2026-06-14', '11:00')).toEqual({
      date: '2026-06-14',
      time: '11:00',
    });
  });

  it('renvoie null quand tout est fermé — l’appelant masque le raccourci', () => {
    expect(pickOpenDayTime([], '2026-06-14', '11:00')).toBeNull();
    expect(
      pickOpenDayTime(
        [
          { date: '2026-06-14', ranges: [] },
          { date: '2026-06-15', ranges: [] },
        ],
        '2026-06-14',
        '11:00'
      )
    ).toBeNull();
  });

  it('ne dépend pas de l’ordre des jours ni des plages reçus', () => {
    const days = [
      { date: '2026-06-16', ranges: OPEN },
      { date: '2026-06-14', ranges: [] },
      { date: '2026-06-15', ranges: [...SPLIT].reverse() },
    ];
    expect(pickOpenDayTime(days, '2026-06-14', '11:00')).toEqual({
      date: '2026-06-15',
      time: '14:00',
    });
  });

  it('accepte l’heure exactement égale à une borne de plage', () => {
    const days = [{ date: '2026-06-14', ranges: AFTERNOON }];
    expect(pickOpenDayTime(days, '2026-06-14', '14:00')?.time).toBe('14:00');
    expect(pickOpenDayTime(days, '2026-06-14', '20:00')?.time).toBe('20:00');
  });
});
