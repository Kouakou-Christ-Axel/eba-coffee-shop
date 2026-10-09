'use client';

import { useCallback, useState } from 'react';
import { cartItemToAnalyticsItem, trackPurchase } from '@/lib/analytics';
import {
  addOrderToHistory,
  readLastContact,
  saveLastContact,
} from '@/lib/order-history';
import type { SoldOutLine } from '@/lib/schemas/order';
import type {
  CheckoutFormValues,
  CheckoutFormErrors,
  UseCheckoutFormResult,
  UseCheckoutFormOptions,
} from './types';
import { validateCheckoutForm } from './validate';
import { submitCheckout } from './submit';

export const INITIAL_VALUES: CheckoutFormValues = {
  customerName: '',
  customerPhone: '',
  pickupMode: 'pickup',
  timing: 'asap',
  pickupTime: null,
  note: '',
  paymentMethod: null,
};

export function useCheckoutForm({
  items,
  total,
  paymentRequired = false,
}: UseCheckoutFormOptions): UseCheckoutFormResult {
  const [values, setValues] = useState<CheckoutFormValues>(() => {
    const last = readLastContact();
    if (!last) return INITIAL_VALUES;
    return {
      ...INITIAL_VALUES,
      customerName: last.name,
      customerPhone: last.phone,
    };
  });
  const [errors, setErrors] = useState<CheckoutFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [soldOutLines, setSoldOutLines] = useState<SoldOutLine[]>([]);
  const clearSoldOutLines = useCallback(() => setSoldOutLines([]), []);

  const setField = useCallback<UseCheckoutFormResult['setField']>(
    (key, value) => {
      setValues((prev) => ({ ...prev, [key]: value }));
      // On efface l'erreur sur le champ modifié pour un feedback immédiat.
      setErrors((prev) => {
        if (!prev[key] && !prev.submit) return prev;
        const next = { ...prev };
        delete next[key];
        delete next.submit;
        return next;
      });
    },
    []
  );

  const submit = useCallback<UseCheckoutFormResult['submit']>(
    async (loyaltyReward) => {
      const validation = validateCheckoutForm(values, items, total, {
        paymentRequired,
      });
      if (Object.keys(validation).length > 0) {
        setErrors(validation);
        // Erreur à corriger dans le formulaire : on referme le panneau
        // « Résoudre » s'il était ouvert, sinon il la masquerait.
        setSoldOutLines([]);
        const first =
          validation.customerName ??
          validation.customerPhone ??
          validation.pickupTime ??
          validation.paymentMethod ??
          validation.note ??
          'Veuillez corriger les champs invalides.';
        return { ok: false, error: first };
      }

      setIsSubmitting(true);
      setErrors({});
      const outcome = await submitCheckout({
        values,
        items,
        total,
        loyaltyRewardId: loyaltyReward?.id ?? null,
      });
      setIsSubmitting(false);
      // Le panneau « Résoudre » reste ouvert pendant un renvoi et se referme
      // de lui-même selon l'issue : nouvelles lignes épuisées, ou rien.
      setSoldOutLines(
        !outcome.ok && outcome.soldOutLines ? outcome.soldOutLines : []
      );
      if (!outcome.ok) {
        // Rupture : pas de message en bas du formulaire, le panneau prend le
        // relais ligne par ligne.
        if (!outcome.soldOutLines?.length) {
          setErrors(
            outcome.field
              ? { [outcome.field]: outcome.error }
              : { submit: outcome.error }
          );
        }
      } else {
        // Total réellement dû (le serveur a déduit la récompense).
        const netTotal = total - Math.min(loyaltyReward?.capAmount ?? 0, total);
        if (!paymentRequired) {
          trackPurchase({
            transactionId: outcome.reference,
            value: netTotal,
            items: items.map(cartItemToAnalyticsItem),
          });
        }
        addOrderToHistory({
          id: outcome.orderId,
          reference: outcome.reference,
          total: netTotal,
          createdAt: new Date().toISOString(),
        });
        saveLastContact({
          name: values.customerName.trim(),
          phone: values.customerPhone.trim(),
        });
      }
      return outcome;
    },
    [values, items, total, paymentRequired]
  );

  return {
    values,
    errors,
    isSubmitting,
    setField,
    submit,
    soldOutLines,
    showSoldOutLines: setSoldOutLines,
    clearSoldOutLines,
  };
}
