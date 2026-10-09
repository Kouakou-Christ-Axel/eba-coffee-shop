import { describe, it, expect } from 'vitest';
import type { Product } from '@/config/menu';
import {
  isAvailableToday,
  isWithinAnyPeriod,
  nextUpcomingPeriod,
  canOrderForLaterDay,
  effectiveItemAdvanceDays,
  isOrderableNow,
} from '../supplements';

const WEDNESDAY = new Date('2026-08-05T10:00:00.000Z');

describe('isAvailableToday', () => {
  it('null/absent = pas de restriction (toujours disponible)', () => {
    expect(isAvailableToday(null, WEDNESDAY)).toBe(true);
    expect(isAvailableToday(undefined, WEDNESDAY)).toBe(true);
  });

  it('jour présent dans la liste → disponible', () => {
    expect(isAvailableToday([3], WEDNESDAY)).toBe(true);
    expect(isAvailableToday([0, 3, 6], WEDNESDAY)).toBe(true);
  });

  it('jour absent de la liste → non disponible', () => {
    expect(isAvailableToday([1, 2], WEDNESDAY)).toBe(false);
  });

  it('tableau vide = intersection sans jour commun → jamais disponible (distinct de null/absent)', () => {
    expect(isAvailableToday([], WEDNESDAY)).toBe(false);
  });
});

describe('isWithinAnyPeriod', () => {
  it('vide/absent = pas de restriction (toujours disponible)', () => {
    expect(isWithinAnyPeriod([], WEDNESDAY)).toBe(true);
    expect(isWithinAnyPeriod(undefined, WEDNESDAY)).toBe(true);
  });

  it('aujourd’hui dans une fenêtre → disponible (bornes incluses)', () => {
    expect(
      isWithinAnyPeriod(
        [{ startDate: '2026-08-03', endDate: '2026-08-09' }],
        WEDNESDAY
      )
    ).toBe(true);
    expect(
      isWithinAnyPeriod(
        [{ startDate: '2026-08-05', endDate: '2026-08-05' }],
        WEDNESDAY
      )
    ).toBe(true);
  });

  it('aujourd’hui hors de toutes les fenêtres → non disponible', () => {
    expect(
      isWithinAnyPeriod(
        [{ startDate: '2026-08-10', endDate: '2026-08-16' }],
        WEDNESDAY
      )
    ).toBe(false);
  });
});

describe('nextUpcomingPeriod', () => {
  it('renvoie null si aucune fenêtre future', () => {
    expect(
      nextUpcomingPeriod(
        [{ startDate: '2026-07-01', endDate: '2026-07-07' }],
        WEDNESDAY
      )
    ).toBeNull();
    expect(nextUpcomingPeriod([], WEDNESDAY)).toBeNull();
  });

  it('renvoie la fenêtre future la plus proche', () => {
    expect(
      nextUpcomingPeriod(
        [
          { startDate: '2026-09-01', endDate: '2026-09-07' },
          { startDate: '2026-08-10', endDate: '2026-08-16' },
        ],
        WEDNESDAY
      )
    ).toEqual({ startDate: '2026-08-10', endDate: '2026-08-16' });
  });
});

// ─── Retrait un autre jour : le stock du jour ne s'applique plus ─────────────
//
// Le piège que ces tests verrouillent : jusqu'ici un goût épuisé était
// SILENCIEUSEMENT retiré de la sélection. Le caissier cochait « Vanille » pour
// demain et l'article partait au panier SANS le goût — une erreur invisible
// jusqu'à la remise au client.

describe('canOrderForLaterDay', () => {
  const base = { id: 'p1', name: 'X', description: '', price: 100 };

  it('accepte un produit épuisé aujourd’hui — il sera produit d’ici là', () => {
    const p = { ...base, soldOut: true } as Product;
    expect(isOrderableNow(p)).toBe(false);
    expect(canOrderForLaterDay(p)).toBe(true);
  });

  it('refuse toujours une PAUSE — ce n’est pas un problème de stock', () => {
    const p = {
      ...base,
      unavailableUntil: new Date(Date.now() + 86_400_000).toISOString(),
    } as Product;
    expect(canOrderForLaterDay(p)).toBe(false);
  });

  it('refuse toujours hors fenêtre « spécialité de la semaine »', () => {
    const p = {
      ...base,
      soldOut: true,
      weeklySpecialPeriods: [
        { startDate: '2000-01-01', endDate: '2000-01-05' },
      ],
    } as Product;
    expect(canOrderForLaterDay(p)).toBe(false);
  });
});

describe('effectiveItemAdvanceDays', () => {
  it('impose J+1 pour un article épuisé au moment de l’ajout', () => {
    expect(effectiveItemAdvanceDays({ soldOutToday: true })).toBe(1);
  });

  it('garde le délai du produit quand il est plus contraignant', () => {
    expect(
      effectiveItemAdvanceDays({ advanceOrderDays: 3, soldOutToday: true })
    ).toBe(3);
  });

  it('vaut 0 pour un article ordinaire', () => {
    expect(effectiveItemAdvanceDays({})).toBe(0);
    expect(effectiveItemAdvanceDays({ advanceOrderDays: null })).toBe(0);
  });
});
