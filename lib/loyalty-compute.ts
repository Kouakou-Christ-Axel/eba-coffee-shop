// lib/loyalty-compute.ts
//
// Logique pure de la carte à tampons (sans Prisma) — testable et partagée.
//
//   - +1 tampon par commande éligible (la décision « éligible » est gérée en
//     amont : montant min, 1/jour, programme actif) ;
//   - récompense au palier intermédiaire (`tier1Stamps`) et au palier final
//     (`stampsPerCard`) ; après le palier final la carte revient à 0.

export type LoyaltyConfig = {
  stampsPerCard: number;
  tier1Stamps: number;
  tier1RewardCap: number;
  tier2RewardCap: number;
};

export type EarnedReward = { tier: number; capAmount: number };

export type AwardResult = {
  /** Nouvel avancement de la carte (0..stampsPerCard-1 après reset). */
  newStampCount: number;
  /** Récompenses débloquées par ce tampon (0, 1 ou 2 entrées). */
  rewards: EarnedReward[];
};

/**
 * Applique 1 tampon à `currentStampCount` et renvoie le nouvel avancement +
 * les récompenses débloquées.
 */
export function computeStampAward(
  currentStampCount: number,
  cfg: LoyaltyConfig
): AwardResult {
  let count = currentStampCount + 1;
  const rewards: EarnedReward[] = [];

  if (
    cfg.tier1Stamps > 0 &&
    cfg.tier1Stamps < cfg.stampsPerCard &&
    count === cfg.tier1Stamps
  ) {
    rewards.push({ tier: cfg.tier1Stamps, capAmount: cfg.tier1RewardCap });
  }

  if (count >= cfg.stampsPerCard) {
    rewards.push({ tier: cfg.stampsPerCard, capAmount: cfg.tier2RewardCap });
    count = 0; // nouvelle carte
  }

  return { newStampCount: count, rewards };
}
