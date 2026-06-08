// lib/loyalty-compute.test.ts
import { describe, it, expect } from 'vitest';
import { computeStampAward, type LoyaltyConfig } from '@/lib/loyalty-compute';

const cfg: LoyaltyConfig = {
  stampsPerCard: 10,
  tier1Stamps: 5,
  tier1RewardCap: 1000,
  tier2RewardCap: 2500,
};

describe('computeStampAward', () => {
  it('incrémente sans récompense hors palier', () => {
    const r = computeStampAward(0, cfg);
    expect(r.newStampCount).toBe(1);
    expect(r.rewards).toEqual([]);
  });

  it('débloque la récompense intermédiaire au palier 5', () => {
    const r = computeStampAward(4, cfg);
    expect(r.newStampCount).toBe(5);
    expect(r.rewards).toEqual([{ tier: 5, capAmount: 1000 }]);
  });

  it('débloque la récompense finale au palier 10 et remet la carte à 0', () => {
    const r = computeStampAward(9, cfg);
    expect(r.newStampCount).toBe(0);
    expect(r.rewards).toEqual([{ tier: 10, capAmount: 2500 }]);
  });

  it('pas de récompense entre les paliers', () => {
    expect(computeStampAward(5, cfg).rewards).toEqual([]);
    expect(computeStampAward(7, cfg).rewards).toEqual([]);
  });

  it('si le palier intermédiaire = taille de carte, une seule récompense finale', () => {
    const single: LoyaltyConfig = { ...cfg, tier1Stamps: 10 };
    const r = computeStampAward(9, single);
    expect(r.newStampCount).toBe(0);
    expect(r.rewards).toEqual([{ tier: 10, capAmount: 2500 }]);
  });
});
