// Mutations de commandes — errors.

/**
 * Erreur métier portant un code HTTP, pour que les routes API renvoient le bon
 * statut (404/403/409/400) sans réécrire la logique. Côté server action / MCP,
 * le message suffit.
 */
export class OrderMutationError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number
  ) {
    super(message);
    this.name = 'OrderMutationError';
  }
}

/**
 * Erreur spécifique au décrément de stock au paiement (toujours 409) —
 * distincte de `OrderMutationError` générique pour que `setOrderPayment` /
 * `payAndComplete` sachent QUAND notifier le client perdant (`ITEM_UNAVAILABLE`)
 * sans confondre avec les autres 409 (déjà payé, conflit de concurrence).
 */
export class StockShortageError extends OrderMutationError {
  constructor(message: string) {
    super(message, 409);
    this.name = 'StockShortageError';
  }
}
