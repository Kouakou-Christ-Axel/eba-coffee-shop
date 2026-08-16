import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  formatPickup,
  isAwaitingKitchenLaunch,
  isDeferredPickup,
  isPickupAt,
  isScheduledAhead,
  minutesUntilPickup,
  orderProductionDay,
  pickupDayOffset,
  pickupDayString,
  pickupISOAt,
  pickupLocalAt,
} from './scheduling';
import type { OrderStatus } from '@/generated/prisma/client';

// Abidjan = UTC+0 : les instants UTC ci-dessous sont donc aussi l'heure murale.
const NOW = new Date('2026-06-13T14:00:00Z');

function order(pickupTime: string | null, status: OrderStatus = 'NEW') {
  return { pickupTime: pickupTime ? new Date(pickupTime) : null, status };
}

describe('pickupDayOffset', () => {
  it('renvoie null sans créneau', () => {
    expect(pickupDayOffset(null, NOW)).toBeNull();
    expect(pickupDayOffset(undefined, NOW)).toBeNull();
  });

  it('compte en jours civils, pas en heures', () => {
    expect(pickupDayOffset(new Date('2026-06-13T23:59:00Z'), NOW)).toBe(0);
    expect(pickupDayOffset(new Date('2026-06-14T00:01:00Z'), NOW)).toBe(1);
    expect(pickupDayOffset(new Date('2026-06-16T09:00:00Z'), NOW)).toBe(3);
  });

  it('renvoie un décalage négatif pour un retrait passé', () => {
    expect(pickupDayOffset(new Date('2026-06-12T09:00:00Z'), NOW)).toBe(-1);
  });
});

describe('isDeferredPickup', () => {
  it('est faux sans créneau (walk-in)', () => {
    expect(isDeferredPickup(null, NOW)).toBe(false);
  });

  it("est faux pour un retrait tardif le jour même — le stock du jour s'applique", () => {
    expect(isDeferredPickup(new Date('2026-06-13T21:30:00Z'), NOW)).toBe(false);
    expect(isDeferredPickup(new Date('2026-06-13T23:59:59Z'), NOW)).toBe(false);
  });

  it('est vrai dès la première minute du lendemain', () => {
    expect(isDeferredPickup(new Date('2026-06-14T00:01:00Z'), NOW)).toBe(true);
  });

  it('est faux pour un retrait déjà passé (jamais différé rétroactivement)', () => {
    expect(isDeferredPickup(new Date('2026-06-12T21:00:00Z'), NOW)).toBe(false);
  });

  it('accepte une chaîne ISO comme une Date', () => {
    expect(isDeferredPickup('2026-06-14T10:00:00Z', NOW)).toBe(true);
    expect(isDeferredPickup('2026-06-13T10:00:00Z', NOW)).toBe(false);
  });
});

describe('orderProductionDay', () => {
  it('retient le jour du retrait quand il existe', () => {
    expect(
      orderProductionDay({
        pickupTime: new Date('2026-06-15T09:00:00Z'),
        createdAt: new Date('2026-06-13T14:00:00Z'),
      })
    ).toBe('2026-06-15');
  });

  it('retombe sur le jour de création sans créneau', () => {
    expect(
      orderProductionDay({
        pickupTime: null,
        createdAt: new Date('2026-06-13T14:00:00Z'),
      })
    ).toBe('2026-06-13');
  });
});

describe('isAwaitingKitchenLaunch', () => {
  it('vise les commandes à créneau encore NEW, payées ou non', () => {
    expect(isAwaitingKitchenLaunch(order('2026-06-14T10:00:00Z'))).toBe(true);
  });

  it("ignore le walk-in sans créneau (il n'a rien à lancer plus tard)", () => {
    expect(isAwaitingKitchenLaunch(order(null))).toBe(false);
  });

  it('ignore une commande déjà partie en cuisine', () => {
    expect(
      isAwaitingKitchenLaunch(order('2026-06-14T10:00:00Z', 'PREPARING'))
    ).toBe(false);
  });
});

describe('non-régression après refactor de localDayDiff', () => {
  it('minutesUntilPickup reste inchangé', () => {
    expect(minutesUntilPickup(order('2026-06-13T14:30:00Z'), NOW)).toBe(30);
    expect(minutesUntilPickup(order(null), NOW)).toBeNull();
  });

  it('formatPickup libelle aujourd’hui / demain / date', () => {
    expect(formatPickup(new Date('2026-06-13T15:30:00Z'), NOW)).toBe(
      "aujourd'hui 15h30"
    );
    expect(formatPickup(new Date('2026-06-14T15:30:00Z'), NOW)).toBe(
      'demain 15h30'
    );
    expect(formatPickup(new Date('2026-06-16T15:30:00Z'), NOW)).toBe(
      '16/06 15h30'
    );
  });

  it('isScheduledAhead reste borné par SCHEDULED_LEAD_IN_MINUTES', () => {
    expect(isScheduledAhead(order('2026-06-13T14:30:00Z'), NOW)).toBe(false);
    expect(isScheduledAhead(order('2026-06-13T16:00:00Z'), NOW)).toBe(true);
    expect(isScheduledAhead(order('2026-06-13T16:00:00Z', 'READY'), NOW)).toBe(
      false
    );
  });
});

// ─── Fabrication d'un créneau « jour + heure » ────────────────────────────────

describe('pickupDayString', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function freeze(iso: string) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(iso));
  }

  it('renvoie aujourd’hui pour un décalage nul, demain pour 1', () => {
    freeze('2026-06-13T14:00:00Z');
    expect(pickupDayString(0)).toBe('2026-06-13');
    expect(pickupDayString(1)).toBe('2026-06-14');
    expect(pickupDayString(2)).toBe('2026-06-15');
  });

  it('franchit le mois et l’année', () => {
    freeze('2026-06-30T22:00:00Z');
    expect(pickupDayString(1)).toBe('2026-07-01');
    freeze('2026-12-31T09:00:00Z');
    expect(pickupDayString(1)).toBe('2027-01-01');
  });

  it('reste sur le jour civil Abidjan en fin de journée', () => {
    // 23h50 à Abidjan : on est encore le 13, demain est bien le 14.
    freeze('2026-06-13T23:50:00Z');
    expect(pickupDayString(0)).toBe('2026-06-13');
    expect(pickupDayString(1)).toBe('2026-06-14');
  });
});

describe('pickupLocalAt / pickupISOAt', () => {
  it('compose la valeur datetime-local avec l’heure par défaut', () => {
    expect(pickupLocalAt('2026-06-14')).toBe('2026-06-14T11:00');
    expect(pickupLocalAt('2026-06-14', '14:30')).toBe('2026-06-14T14:30');
  });

  it('produit un ISO ancré Abidjan (UTC), relisible à l’identique', () => {
    expect(pickupISOAt('2026-06-14')).toBe('2026-06-14T11:00:00.000Z');
    expect(pickupISOAt('2026-06-14', '14:30')).toBe('2026-06-14T14:30:00.000Z');
  });

  it('renvoie null sur une entrée invalide plutôt qu’une date NaN', () => {
    expect(pickupISOAt('pas-une-date')).toBeNull();
    expect(pickupISOAt('2026-06-14', 'midi')).toBeNull();
  });
});

describe('isPickupAt', () => {
  it('est vrai à la minute exacte, faux une minute à côté', () => {
    expect(isPickupAt('2026-06-14T11:00:00.000Z', '2026-06-14')).toBe(true);
    expect(isPickupAt('2026-06-14T11:01:00.000Z', '2026-06-14')).toBe(false);
    expect(isPickupAt('2026-06-15T11:00:00.000Z', '2026-06-14')).toBe(false);
  });

  it('accepte une Date comme une chaîne ISO', () => {
    expect(isPickupAt(new Date('2026-06-14T11:00:00Z'), '2026-06-14')).toBe(
      true
    );
  });

  it('honore une heure personnalisée', () => {
    expect(isPickupAt('2026-06-14T14:30:00Z', '2026-06-14', '14:30')).toBe(
      true
    );
    expect(isPickupAt('2026-06-14T14:30:00Z', '2026-06-14')).toBe(false);
  });

  it('est faux sans créneau — un raccourci ne s’allume pas sur du vide', () => {
    expect(isPickupAt(null, '2026-06-14')).toBe(false);
    expect(isPickupAt(undefined, '2026-06-14')).toBe(false);
  });

  it('ignore les secondes de la valeur stockée', () => {
    // `isoToAbidjanDatetimeLocal` tronque à la minute : une commande posée avec
    // des secondes non nulles reste reconnue comme « demain 11h ».
    expect(isPickupAt('2026-06-14T11:00:45.000Z', '2026-06-14')).toBe(true);
  });
});
