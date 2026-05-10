import type { CartItem } from '@/lib/cart-store';

export type CheckoutFields = {
  customerName: string;
  customerPhone: string;
  pickupTime: string | null;
};

export type CheckoutErrors = {
  customerName?: string;
  customerPhone?: string;
  pickupTime?: string;
  submit?: string;
};

export type CheckoutSubmitOptions = {
  fields: CheckoutFields;
  items: CartItem[];
  total: number;
  onSuccess: (orderId: string) => void;
  onError: (errors: CheckoutErrors) => void;
};

export function validateCheckoutInput(fields: CheckoutFields): CheckoutErrors {
  const errors: CheckoutErrors = {};

  if (!fields.customerName || fields.customerName.trim().length < 2) {
    errors.customerName = 'Prénom requis (min 2 caractères)';
  }
  if (!fields.customerPhone || fields.customerPhone.trim().length < 8) {
    errors.customerPhone = 'Numéro requis (min 8 chiffres)';
  }
  if (!fields.pickupTime) {
    errors.pickupTime = 'Veuillez choisir un créneau';
  }

  return errors;
}

export async function submitCheckoutForm({
  fields,
  items,
  total,
  onSuccess,
  onError,
}: CheckoutSubmitOptions): Promise<void> {
  const errors = validateCheckoutInput(fields);
  if (Object.keys(errors).length > 0) {
    onError(errors);
    return;
  }

  let response: Response;
  try {
    response = await fetch('/api/commandes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: fields.customerName.trim(),
        customerPhone: fields.customerPhone.trim(),
        pickupTime: fields.pickupTime,
        items,
        total,
      }),
    });
  } catch {
    onError({
      submit: 'Impossible de contacter le serveur. Veuillez réessayer.',
    });
    return;
  }

  if (!response.ok) {
    onError({ submit: 'Une erreur est survenue. Veuillez réessayer.' });
    return;
  }

  const data = (await response.json()) as { id: string };
  onSuccess(data.id);
}
