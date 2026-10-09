// Attribution des tampons et récompenses fidélité. Implémentation dans `lib/loyalty/mutations/`.

export { LoyaltyRewardUnavailableError } from './loyalty/mutations/errors';
export {
  resolveLoyaltyReward,
  consumeLoyaltyReward,
} from './loyalty/mutations/rewards';
export { awardLoyaltyForOrder } from './loyalty/mutations/award';
export type { EarnedRewardRow } from './loyalty/mutations/award';
export {
  revokeLoyaltyForOrder,
  restoreLoyaltyForOrder,
} from './loyalty/mutations/revoke';
export {
  adjustStamps,
  awardMissedOrderStamps,
} from './loyalty/mutations/adjust';
