// Réservations de stock par ressource pour les programmées du jour (cf. reserve.ts).

export {
  computeHolds,
  holdKey,
  isFullyHeld,
  needsToMap,
  parseHoldKey,
  type HoldKind,
  type HoldMap,
} from './keys';
export {
  loadHolds,
  readStockByKeys,
  loadHoldsForOrders,
  releaseHolds,
  releaseStaleHolds,
} from './holds';
export {
  reserveForScheduledOrders,
  reserveForScheduledOrdersSafe,
  type ReserveResult,
} from './reserve';
export { decrementResidualNeeds } from './consume';
export {
  isHoldCandidate,
  summarizeStockHolds,
  toSummary,
  type StockHoldDetail,
  type StockHoldSummary,
} from './state';
