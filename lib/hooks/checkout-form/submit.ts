import type { CartItem } from '@/lib/cart-store';
import type { CheckoutErrorCode, SoldOutLine } from '@/lib/schemas/order';
import type { CheckoutFormValues, CheckoutSubmitOutcome } from './types';
import { mapCheckoutError } from './errors';

export type SubmitArgs = {
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
        // Paiement en ligne : moyen choisi par le client. Le montant n'est PAS
        // envoyé — le serveur le recalcule (panier, remise, frais) et l'impose.
        ...(values.paymentMethod
          ? { paymentMethod: values.paymentMethod }
          : {}),
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
    const data = (await response.json()) as {
      id: string;
      reference: string;
      paymentUrl?: string | null;
      paymentError?: string;
    };
    return {
      ok: true,
      orderId: data.id,
      reference: data.reference,
      paymentUrl: data.paymentUrl ?? null,
      paymentError: Boolean(data.paymentError),
    };
  } catch {
    return {
      ok: false,
      error: 'Réponse inattendue du serveur. Veuillez réessayer.',
    };
  }
}
