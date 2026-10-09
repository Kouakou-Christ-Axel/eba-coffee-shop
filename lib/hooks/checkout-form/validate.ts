import { ORDER_NOTE_MAX } from '@/config/constants';
import type { CartItem } from '@/lib/cart-store';
import {
  createOrderSchema,
  onlineCustomerNameSchema,
  onlineCustomerPhoneSchema,
} from '@/lib/schemas/order';
import {
  effectiveItemAdvanceDays,
  isAvailableToday,
  isPickupDateAllowed,
  isWithinAnyPeriod,
} from '@/lib/supplements';
import type { CheckoutFormValues, CheckoutFormErrors } from './types';

/** Valide les champs côté client en s'appuyant sur `createOrderSchema`. */
export function validateCheckoutForm(
  values: CheckoutFormValues,
  items: CartItem[],
  total: number,
  options?: {
    /** Le paiement en ligne est actif : un moyen de paiement est obligatoire. */
    paymentRequired?: boolean;
  }
): CheckoutFormErrors {
  const errors: CheckoutFormErrors = {};

  if (options?.paymentRequired && !values.paymentMethod) {
    errors.paymentMethod = 'Choisis un moyen de paiement';
  }

  const name = values.customerName.trim();
  if (name.length === 0) {
    errors.customerName = 'Nom et prénom requis';
  } else {
    const nameResult = onlineCustomerNameSchema.safeParse(name);
    if (!nameResult.success) {
      errors.customerName = nameResult.error.issues[0]?.message;
    }
  }

  const phone = values.customerPhone.trim();
  if (phone.length === 0) {
    errors.customerPhone = 'Numéro de téléphone requis';
  } else {
    const phoneResult = onlineCustomerPhoneSchema.safeParse(phone);
    if (!phoneResult.success) {
      errors.customerPhone = phoneResult.error.issues[0]?.message;
    }
  }

  // Créneau exigé seulement en mode planifié ; « dès que possible » n'a pas
  // de rendez-vous (pickupTime null, traité comme un walk-in côté caisse).
  if (values.timing === 'scheduled' && !values.pickupTime) {
    errors.pickupTime = 'Veuillez choisir un créneau';
  }

  if (!errors.pickupTime) {
    // Inclut les articles épuisés aujourd'hui (J+1 minimum) — même canal que
    // `advanceOrderDays`, voir `effectiveItemAdvanceDays`.
    const requiredAdvanceDays = items.reduce(
      (max, i) => Math.max(max, effectiveItemAdvanceDays(i)),
      0
    );
    const soldOutDriven = items.some((i) => i.soldOutToday === true);
    const submittedPickupTime =
      values.timing === 'scheduled' ? values.pickupTime : null;
    if (
      requiredAdvanceDays > 0 &&
      !isPickupDateAllowed(requiredAdvanceDays, submittedPickupTime)
    ) {
      errors.pickupTime = soldOutDriven
        ? 'Un article de votre panier est épuisé aujourd’hui : choisissez un jour à partir de demain.'
        : `Cet article doit être commandé au moins ${requiredAdvanceDays} jour(s) à l'avance.`;
    }
  }

  if (!errors.pickupTime) {
    const target =
      values.timing === 'scheduled' && values.pickupTime
        ? new Date(values.pickupTime)
        : new Date();
    const blockedItem = items.find(
      (i) =>
        !isAvailableToday(i.availableDays ?? null, target) ||
        !isWithinAnyPeriod(i.weeklySpecialPeriods ?? null, target)
    );
    if (blockedItem) {
      errors.pickupTime = `${blockedItem.productName} n'est pas disponible à cette date.`;
    }
  }

  const note = values.note.trim();
  if (note.length > ORDER_NOTE_MAX) {
    errors.note = `Note trop longue (max ${ORDER_NOTE_MAX} caractères)`;
  }

  // Garde-fous business : on délègue le reste au schéma Zod partagé pour
  // refléter immédiatement toute divergence côté serveur.
  const parsed = createOrderSchema.safeParse({
    customerName: name || undefined,
    customerPhone: phone || undefined,
    pickupTime: values.pickupTime ?? undefined,
    items,
    total,
    note: note ? note : undefined,
  });
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    (['customerName', 'customerPhone', 'pickupTime', 'note'] as const).forEach(
      (key) => {
        if (!errors[key] && flat[key]?.[0]) errors[key] = flat[key]![0]!;
      }
    );
  }

  return errors;
}
