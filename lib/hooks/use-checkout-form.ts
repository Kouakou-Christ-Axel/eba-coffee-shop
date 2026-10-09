'use client';

// Formulaire de checkout public (Click & Collect) : état, validation, soumission. Implémentation dans `lib/hooks/checkout-form/`.

export type {
  PickupMode,
  PickupTiming,
  CheckoutFormValues,
  CheckoutFormErrors,
  CheckoutSubmitOutcome,
  CheckoutLoyaltyReward,
  UseCheckoutFormResult,
  UseCheckoutFormOptions,
} from './checkout-form/types';
export { validateCheckoutForm } from './checkout-form/validate';
export { SERVER_ERROR_MESSAGE, mapCheckoutError } from './checkout-form/errors';
export { submitCheckout } from './checkout-form/submit';
export { useCheckoutForm } from './checkout-form/use-checkout-form';
