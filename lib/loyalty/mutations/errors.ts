export class LoyaltyRewardUnavailableError extends Error {
  constructor(message = 'Récompense fidélité indisponible') {
    super(message);
    this.name = 'LoyaltyRewardUnavailableError';
  }
}
