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
import { cartItemToAnalyticsItem, trackPurchase } from '@/lib/analytics';
import {
  addOrderToHistory,
  readLastContact,
  saveLastContact,
} from '@/lib/order-history';
import {
  createOrderSchema,
  type CheckoutErrorCode,
  type SoldOutLine,
} from '@/lib/schemas/order';
import { extractApiError } from '@/lib/api-error';
import {
  effectiveItemAdvanceDays,
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
};

export type CheckoutFormErrors = Partial<
  Record<keyof CheckoutFormValues | 'submit', string>
>;

export type CheckoutSubmitOutcome =
  | { ok: true; orderId: string; reference: string }
  | {
      ok: false;
      error: string;
      /** Code serveur (`checkoutErrorCodeSchema`) — absent pour une erreur
       * réseau ou une réponse illisible. */
      code?: CheckoutErrorCode;
      /** Champ du formulaire auquel rattacher `error` plutôt qu'au bas du
       * formulaire (ex. le créneau pour un délai à l'avance). */
      field?: 'pickupTime';
      /** Lignes épuisées (`SOLD_OUT_TODAY`) : ouvrent le panneau
       * « Résoudre » au lieu d'un simple message. */
      soldOutLines?: SoldOutLine[];
    };

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
  /** Lignes refusées par la dernière soumission (rupture du jour) — vide
   * sinon. Le panneau « Résoudre » s'ouvre tant qu'il y en a. */
  soldOutLines: SoldOutLine[];
  /** Ouvre le panneau « Résoudre » sans aller-retour serveur, avec des
   * lignes détectées côté client (`checkCartAgainstMenu`). */
  showSoldOutLines: (lines: SoldOutLine[]) => void;
  clearSoldOutLines: () => void;
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

/** Message quand le serveur a échoué (5xx) : on rassure sur l'état — rien
 * n'a été enregistré, réessayer ne créera pas de doublon. */
export const SERVER_ERROR_MESSAGE =
  'Petit souci de notre côté : ta commande n’a pas été enregistrée. Réessaie dans un instant.';

/**
 * Traduit une réponse d'erreur de POST /api/commandes en issue affichable.
 * Aiguille sur le `code` stable renvoyé par la route — jamais sur le texte
 * du message, qu'on doit pouvoir reformuler sans casser le client.
 */
export function mapCheckoutError(
  status: number,
  data: { code?: CheckoutErrorCode; error?: unknown; items?: SoldOutLine[] }
): Extract<CheckoutSubmitOutcome, { ok: false }> {
  const message = extractApiError(data.error);
  switch (data.code) {
    case 'SOLD_OUT_TODAY':
      return {
        ok: false,
        code: data.code,
        error: message ?? 'Un article de votre panier est épuisé aujourd’hui.',
        soldOutLines: data.items ?? [],
      };
    // Délai à l'avance / planning : le serveur nomme déjà l'article et la
    // règle ; on rattache le message au sélecteur de créneau, là où le
    // client peut agir.
    case 'ADVANCE_ORDER_REQUIRED':
    case 'SCHEDULE_UNAVAILABLE':
      return {
        ok: false,
        code: data.code,
        field: 'pickupTime',
        error: message ?? 'Choisissez une autre date de retrait.',
      };
    // Récompense consommée entre-temps (ex. au comptoir).
    case 'LOYALTY_REWARD_UNAVAILABLE':
      return {
        ok: false,
        code: data.code,
        error:
          'Récompense fidélité indisponible — réessaie sans la récompense.',
      };
    case 'VALIDATION':
      return {
        ok: false,
        code: data.code,
        error: message
          ? `Certaines informations sont invalides (${message}).`
          : 'Certaines informations sont invalides.',
      };
  }
  if (status >= 500) {
    return { ok: false, code: data.code, error: SERVER_ERROR_MESSAGE };
  }
  return { ok: false, error: 'Une erreur est survenue. Veuillez réessayer.' };
}

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
    const data = (await response.json().catch(() => ({}))) as {
      code?: CheckoutErrorCode;
      error?: unknown;
      items?: SoldOutLine[];
    };
    return mapCheckoutError(response.status, data);
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
      const validation = validateCheckoutForm(values, items, total);
      if (Object.keys(validation).length > 0) {
        setErrors(validation);
        // Erreur à corriger dans le formulaire : on referme le panneau
        // « Résoudre » s'il était ouvert, sinon il la masquerait.
        setSoldOutLines([]);
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
        // Conversion GA4. `transaction_id` = la référence de commande, seule
        // clé stable et lisible côté caisse pour rapprocher un chiffre GA4
        // d'une commande réelle.
        trackPurchase({
          transactionId: outcome.reference,
          value: netTotal,
          items: items.map(cartItemToAnalyticsItem),
        });
        // Historique local « mes commandes » + coordonnées pour le prochain
        // checkout — l'effet « compte » sans compte (best-effort, jamais
        // bloquant : les helpers avalent un localStorage indisponible).
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
    [values, items, total]
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
