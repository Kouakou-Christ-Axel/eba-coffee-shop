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
import {
  addOrderToHistory,
  readLastContact,
  saveLastContact,
} from '@/lib/order-history';
import { createOrderSchema } from '@/lib/schemas/order';
import {
  isAvailableToday,
  isPickupDateAllowed,
  isWithinAnyPeriod,
} from '@/lib/supplements';

// ─── Types publics ───────────────────────────────────────────────────────────

/** Qui récupère : le client lui-même (TAKEAWAY) ou son livreur (DELIVERY). */
export type PickupMode = 'pickup' | 'driver';

/** Quand : dès que possible (pas de créneau) ou à un créneau planifié. */
export type PickupTiming = 'asap' | 'scheduled';

export type CheckoutFormValues = {
  customerName: string;
  customerPhone: string;
  // 1ʳᵉ question du modal : mode de récupération (cf. processus terrain).
  pickupMode: PickupMode;
  // « Dès que possible » (défaut, préparation immédiate comme un walk-in) ou
  // créneau planifié — `pickupTime` n'est requis que dans ce second cas.
  timing: PickupTiming;
  pickupTime: string | null;
  note: string;
  // Livreur envoyé par le client (optionnel au checkout, modifiable ensuite
  // depuis la page de suivi). Les deux champs vont ensemble.
  driverName: string;
  driverPhone: string;
};

export type CheckoutFormErrors = Partial<
  Record<keyof CheckoutFormValues | 'submit', string>
>;

export type CheckoutSubmitOutcome =
  | { ok: true; orderId: string; reference: string }
  | { ok: false; error: string };

/**
 * Récompense fidélité appliquée à la soumission. Passée à `submit()` (et non
 * à la construction du hook) car elle dépend du téléphone saisi, lui-même
 * détenu par ce hook.
 */
export type CheckoutLoyaltyReward = {
  id: string;
  /** Plafond de la récompense — sert au total mémorisé dans l'historique
   * local ; le montant réellement déduit est recalculé côté serveur. */
  capAmount: number;
};

export type UseCheckoutFormResult = {
  values: CheckoutFormValues;
  errors: CheckoutFormErrors;
  isSubmitting: boolean;
  setField: <K extends keyof CheckoutFormValues>(
    key: K,
    value: CheckoutFormValues[K]
  ) => void;
  submit: (
    loyaltyReward?: CheckoutLoyaltyReward | null
  ) => Promise<CheckoutSubmitOutcome>;
};

export type UseCheckoutFormOptions = {
  items: CartItem[];
  /** Total BRUT du panier ; le serveur déduit lui-même la récompense. */
  total: number;
};

const INITIAL_VALUES: CheckoutFormValues = {
  customerName: '',
  customerPhone: '',
  pickupMode: 'pickup',
  timing: 'asap',
  pickupTime: null,
  note: '',
  driverName: '',
  driverPhone: '',
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

  // Créneau exigé seulement en mode planifié ; « dès que possible » n'a pas
  // de rendez-vous (pickupTime null, traité comme un walk-in côté caisse).
  if (values.timing === 'scheduled' && !values.pickupTime) {
    errors.pickupTime = 'Veuillez choisir un créneau';
  }

  // Confort client (la vérité reste le contrôle serveur, voir
  // `createOrder`/`AdvanceOrderRequiredError`, lib/orders.ts) : un article du
  // panier peut exiger un délai de commande à l'avance (jours) supérieur à
  // la date de retrait effectivement soumise.
  if (!errors.pickupTime) {
    const requiredAdvanceDays = items.reduce(
      (max, i) => Math.max(max, i.advanceOrderDays ?? 0),
      0
    );
    const submittedPickupTime =
      values.timing === 'scheduled' ? values.pickupTime : null;
    if (
      requiredAdvanceDays > 0 &&
      !isPickupDateAllowed(requiredAdvanceDays, submittedPickupTime)
    ) {
      errors.pickupTime = `Cet article doit être commandé au moins ${requiredAdvanceDays} jour(s) à l'avance.`;
    }
  }

  // Confort client (la vérité reste le contrôle serveur, voir
  // `createOrder`/`ScheduleUnavailableError`, lib/orders.ts) : un article du
  // panier peut être hors de son planning récurrent ou de sa fenêtre
  // « spécialité de la semaine » à la date effectivement soumise (« dès que
  // possible » est vérifié contre maintenant).
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

  // Livreur : bloc optionnel, mais nom et téléphone vont ensemble (mêmes
  // règles que setOrderDriverSchema côté serveur).
  const driverName = values.driverName.trim();
  const driverPhone = values.driverPhone.trim();
  if (driverName || driverPhone) {
    if (driverName.length < 2) {
      errors.driverName = 'Nom du livreur requis (min 2 caractères)';
    } else if (driverName.length > ORDER_CUSTOMER_NAME_MAX) {
      errors.driverName = `Nom trop long (max ${ORDER_CUSTOMER_NAME_MAX} caractères)`;
    }
    if (driverPhone.length < 8) {
      errors.driverPhone = 'Numéro du livreur requis (min 8 chiffres)';
    } else if (driverPhone.length > ORDER_CUSTOMER_PHONE_MAX) {
      errors.driverPhone = `Téléphone trop long (max ${ORDER_CUSTOMER_PHONE_MAX} caractères)`;
    }
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
  loyaltyRewardId?: string | null;
};

export async function submitCheckout({
  values,
  items,
  total,
  loyaltyRewardId,
}: SubmitArgs): Promise<CheckoutSubmitOutcome> {
  let response: Response;
  try {
    response = await fetch('/api/commandes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: values.customerName.trim(),
        customerPhone: values.customerPhone.trim(),
        // « J'envoie un livreur » = DELIVERY (la cuisine voit le signal
        // livreur) ; « Je viens moi-même » = TAKEAWAY.
        orderType: values.pickupMode === 'driver' ? 'DELIVERY' : 'TAKEAWAY',
        // asap = pas de rendez-vous : préparation immédiate (walk-in).
        pickupTime: values.timing === 'scheduled' ? values.pickupTime : null,
        items,
        total,
        ...(values.note.trim() ? { note: values.note.trim() } : {}),
        ...(values.driverName.trim() && values.driverPhone.trim()
          ? {
              driverName: values.driverName.trim(),
              driverPhone: values.driverPhone.trim(),
            }
          : {}),
        // Le serveur revalide la récompense (appartenance au client résolu du
        // téléphone, statut AVAILABLE) et déduit lui-même la remise du total.
        ...(loyaltyRewardId ? { loyaltyRewardId } : {}),
      }),
    });
  } catch {
    return {
      ok: false,
      error: 'Impossible de contacter le serveur. Veuillez réessayer.',
    };
  }

  if (!response.ok) {
    // Récompense fidélité consommée entre-temps (ex. au comptoir) : message
    // actionnable plutôt qu'une erreur générique.
    if (response.status === 400) {
      const data = (await response.json().catch(() => ({}))) as {
        error?: unknown;
      };
      if (
        typeof data.error === 'string' &&
        data.error.includes('Récompense fidélité')
      ) {
        return {
          ok: false,
          error:
            'Récompense fidélité indisponible — réessaie sans la récompense.',
        };
      }
      // Délai de commande à l'avance non respecté (voir
      // `AdvanceOrderRequiredError`, lib/orders.ts) — message déjà explicite
      // côté serveur, on le remonte tel quel.
      if (typeof data.error === 'string' && data.error.includes("à l'avance")) {
        return { ok: false, error: data.error };
      }
      // Article hors planning récurrent / fenêtre « spécialité de la
      // semaine » à la date choisie (voir `ScheduleUnavailableError`,
      // lib/orders.ts) — message déjà explicite côté serveur, idem.
      if (
        typeof data.error === 'string' &&
        data.error.includes("n'est pas disponible à cette date")
      ) {
        return { ok: false, error: data.error };
      }
    }
    return {
      ok: false,
      error: 'Une erreur est survenue. Veuillez réessayer.',
    };
  }

  try {
    const data = (await response.json()) as { id: string; reference: string };
    return { ok: true, orderId: data.id, reference: data.reference };
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
  // Pré-remplissage « client fidèle » : coordonnées de la dernière commande
  // passée depuis cet appareil (lib/order-history.ts). Initialiseur paresseux
  // sûr ici : le checkout n'est monté qu'après hydratation du panier
  // (checkout-page.tsx rend null côté serveur), donc pas de mismatch SSR.
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
      const validation = validateCheckoutForm(values, items, total);
      if (Object.keys(validation).length > 0) {
        setErrors(validation);
        const first =
          validation.customerName ??
          validation.customerPhone ??
          validation.pickupTime ??
          validation.note ??
          validation.driverName ??
          validation.driverPhone ??
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
      if (!outcome.ok) {
        setErrors({ submit: outcome.error });
      } else {
        // Historique local « mes commandes » + coordonnées pour le prochain
        // checkout — l'effet « compte » sans compte (best-effort, jamais
        // bloquant : les helpers avalent un localStorage indisponible).
        addOrderToHistory({
          id: outcome.orderId,
          reference: outcome.reference,
          // Total réellement dû (le serveur a déduit la récompense).
          total: total - Math.min(loyaltyReward?.capAmount ?? 0, total),
          createdAt: new Date().toISOString(),
        });
        saveLastContact({
          name: values.customerName.trim(),
          phone: values.customerPhone.trim(),
        });
      }
      return outcome;
    },
    [values, items, total]
  );

  return { values, errors, isSubmitting, setField, submit };
}
