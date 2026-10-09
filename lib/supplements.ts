// Logique pure de sélection de suppléments (caisse et site public). Implémentation dans `lib/supplements/`.

export {
  isPausedNow,
  isAvailableToday,
  isWithinAnyPeriod,
  isOrderableNow,
  canOrderForLaterDay,
  isPickupDateAllowed,
  effectiveItemAdvanceDays,
  minAllowedPickupDateString,
  nextUpcomingPeriod,
} from './supplements/availability';
export {
  groupSelectionCount,
  multipleSelection,
  optionQuantity,
  effectiveMin,
  effectiveMax,
  isGroupValid,
  canSubmitSelections,
  groupConstraintLabel,
} from './supplements/rules';
export type {
  GroupSelection,
  Selections,
  SupplementRules,
} from './supplements/rules';
export {
  buildInitialSelections,
  getSelectedSupplements,
  getSupplementsPrice,
} from './supplements/selections';
export {
  isFixedPortionGroup,
  portionCount,
  portionSlots,
  stripPortionSuffix,
} from './supplements/portions';
