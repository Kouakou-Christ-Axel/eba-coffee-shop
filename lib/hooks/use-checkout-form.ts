'use client';

// lib/hooks/use-checkout-form.ts
//
// Hook orchestrant le formulaire de checkout (commande online "Click & Collect").
//
// Encapsule :
//   - l'état des champs (name, phone, pickupTime, note)
//   - la validation via `createOrderSchema` (lib/schemas/order.ts)
//   - la soumission HTTP vers POST /api/commandes
//
// Le composant `<CheckoutForm>` reste responsable de l'UI (créneaux, layout,
// boutons) ; il consomme uniquement `values / errors / setField / submit`.

import { useCallback, useState } from 'react';
import {
  ORDER_CUSTOMER_NAME_MAX,
  ORDER_CUSTOMER_PHONE_MAX,
  ORDER_NOTE_MAX,
} from '@/config/constants';
import type { CartItem } from '@/lib/cart-store';
import { createOrderSchema } from '@/lib/schemas/order';

// ─── Types publics ───────────────────────────────────────────────────────────

export type CheckoutFormValues = {
  customerName: string;
  customerPhone: string;
  pickupTime: string | null;
  note: string;
};

export type CheckoutFormErrors = Partial<
  Record<keyof CheckoutFormValues | 'submit', string>
>;

export type CheckoutSubmitOutcome =
  | { ok: true; orderId: string }
  | { ok: false; error: string };

export type UseCheckoutFormResult = {
  values: CheckoutFormValues;
  errors: CheckoutFormErrors;
  isSubmitting: boolean;
  setField: <K extends keyof CheckoutFormValues>(
    key: K,
    value: CheckoutFormValues[K]
  ) => void;
  submit: () => Promise<CheckoutSubmitOutcome>;
};

export type UseCheckoutFormOptions = {
  items: CartItem[];
  total: number;
};

const INITIAL_VALUES: CheckoutFormValues = {
  customerName: '',
  customerPhone: '',
  pickupTime: null,
  note: '',
};

// ─── Validation pure (testable sans DOM) ─────────────────────────────────────

/**
 * Valide les champs côté client en s'appuyant sur `createOrderSchema`.
 *
 * `createOrderSchema` rend customerName/customerPhone optionnels (cas caisse) ;
 * en mode online ils sont obligatoires, donc on ajoute des règles min/length
 * équivalentes à celles déjà appliquées côté API par lib/orders.ts.
 */
export function validateCheckoutForm(
  values: CheckoutFormValues,
  items: CartItem[],
  total: number
): CheckoutFormErrors {
  const errors: CheckoutFormErrors = {};

  const name = values.customerName.trim();
  if (name.length < 2) {
    errors.customerName = 'Prénom requis (min 2 caractères)';
  } else if (name.length > ORDER_CUSTOMER_NAME_MAX) {
    errors.customerName = `Nom trop long (max ${ORDER_CUSTOMER_NAME_MAX} caractères)`;
  }

  const phone = values.customerPhone.trim();
  if (phone.length < 8) {
    errors.customerPhone = 'Numéro requis (min 8 chiffres)';
  } else if (phone.length > ORDER_CUSTOMER_PHONE_MAX) {
    errors.customerPhone = `Téléphone trop long (max ${ORDER_CUSTOMER_PHONE_MAX} caractères)`;
  }

  if (!values.pickupTime) {
    errors.pickupTime = 'Veuillez choisir un créneau';
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

// ─── Submission HTTP (pure / mockable) ───────────────────────────────────────

type SubmitArgs = {
  values: CheckoutFormValues;
  items: CartItem[];
  total: number;
};

export async function submitCheckout({
  values,
  items,
  total,
}: SubmitArgs): Promise<CheckoutSubmitOutcome> {
  let response: Response;
  try {
    response = await fetch('/api/commandes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: values.customerName.trim(),
        customerPhone: values.customerPhone.trim(),
        pickupTime: values.pickupTime,
        items,
        total,
        ...(values.note.trim() ? { note: values.note.trim() } : {}),
      }),
    });
  } catch {
    return {
      ok: false,
      error: 'Impossible de contacter le serveur. Veuillez réessayer.',
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: 'Une erreur est survenue. Veuillez réessayer.',
    };
  }

  try {
    const data = (await response.json()) as { id: string };
    return { ok: true, orderId: data.id };
  } catch {
    return {
      ok: false,
      error: 'Réponse inattendue du serveur. Veuillez réessayer.',
    };
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useCheckoutForm({
  items,
  total,
}: UseCheckoutFormOptions): UseCheckoutFormResult {
  const [values, setValues] = useState<CheckoutFormValues>(INITIAL_VALUES);
  const [errors, setErrors] = useState<CheckoutFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const submit = useCallback(async (): Promise<CheckoutSubmitOutcome> => {
    const validation = validateCheckoutForm(values, items, total);
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      const first =
        validation.customerName ??
        validation.customerPhone ??
        validation.pickupTime ??
        validation.note ??
        'Veuillez corriger les champs invalides.';
      return { ok: false, error: first };
    }

    setIsSubmitting(true);
    setErrors({});
    const outcome = await submitCheckout({ values, items, total });
    setIsSubmitting(false);
    if (!outcome.ok) {
      setErrors({ submit: outcome.error });
    }
    return outcome;
  }, [values, items, total]);

  return { values, errors, isSubmitting, setField, submit };
}
