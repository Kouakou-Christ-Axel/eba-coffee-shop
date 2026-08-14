import { describe, it, expect } from 'vitest';
import {
  formatPickup,
  isAwaitingKitchenLaunch,
  isDeferredPickup,
  isScheduledAhead,
  minutesUntilPickup,
  orderProductionDay,
  pickupDayOffset,
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
