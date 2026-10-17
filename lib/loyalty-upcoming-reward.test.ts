// lib/loyalty-upcoming-reward.test.ts
//
// `computeUpcomingReward` : l'aperçu du récapitulatif doit refléter exactement
// ce que `awardLoyaltyForOrder` appliquera d'office à la création.

import { describe, expect, it } from 'vitest';
import { computeUpcomingReward } from './loyalty-compute';

const TODAY = new Date('2026-10-17T00:00:00.000Z');
const settings = {
  enabled: true,
  minOrderAmount: 2000,
  oneStampPerDay: true,
  stampsPerCard: 10,
  tier1Stamps: 5,
  tier1RewardCap: 1000,
  tier2RewardCap: 2000,
};
const base = {
  lastStampDate: new Date('2026-10-13T00:00:00.000Z'),
  today: TODAY,
  cartTotal: 3000,
  settings,
};

describe('computeUpcomingReward', () => {
  it('annonce la grande réduction quand le tampon fait atteindre la carte pleine', () => {
    expect(computeUpcomingReward({ ...base, stampCount: 9 })).toEqual({
      capAmount: 2000,
    });
  });

  it('annonce la réduction intermédiaire au palier 1', () => {
    expect(computeUpcomingReward({ ...base, stampCount: 4 })).toEqual({
      capAmount: 1000,
    });
  });

  it("n'annonce rien hors palier", () => {
    expect(computeUpcomingReward({ ...base, stampCount: 6 })).toBeNull();
  });

  it('exige le montant minimum', () => {
    expect(
      computeUpcomingReward({ ...base, stampCount: 9, cartTotal: 1999 })
    ).toBeNull();
  });

  it('respecte la règle un tampon par jour', () => {
    expect(
      computeUpcomingReward({ ...base, stampCount: 9, lastStampDate: TODAY })
    ).toBeNull();
  });

  it('ne fait rien si le programme est désactivé', () => {
    expect(
      computeUpcomingReward({
        ...base,
        stampCount: 9,
        settings: { ...settings, enabled: false },
      })
    ).toBeNull();
  });
});
