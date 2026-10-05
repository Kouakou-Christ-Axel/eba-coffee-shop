// lib/orders/public-error-response.ts
//
// Traduction des erreurs métier du flux PUBLIC (création de commande et
// libre-service après commande) en réponse HTTP, toujours avec un `code`
// stable (`checkoutErrorCodeSchema`, lib/schemas/order.ts) : le client
// aiguille dessus, jamais sur le texte du message.

import { NextResponse } from 'next/server';
import {
  AdvanceOrderRequiredError,
  ScheduleUnavailableError,
  SoldOutTodayError,
} from '@/lib/orders';
import { LoyaltyRewardUnavailableError } from '@/lib/loyalty-mutations';
import { OrderMutationError } from '@/lib/order-mutations';
import { CartMismatchError } from '@/lib/orders/cart-verification';
import { JekoApiError } from '@/lib/jeko/client';
import { PaymentNotPendingError } from '@/lib/jeko/start-payment';
import type { CheckoutErrorCode } from '@/lib/schemas/order';

export function publicOrderError(
  status: number,
  code: CheckoutErrorCode,
  error: unknown,
  extra: Record<string, unknown> = {}
) {
  return NextResponse.json({ code, error, ...extra }, { status });
}

/** Réponse pour une erreur levée par `createOrder` ou le libre-service.
 * Une erreur inconnue est journalisée sous `context` et renvoie une 500. */
export function publicOrderErrorResponse(err: unknown, context: string) {
  // Récompense consommée entre l'affichage du checkout et la soumission
  // (ex. utilisée au comptoir) : erreur métier, pas une erreur serveur.
  if (err instanceof LoyaltyRewardUnavailableError) {
    return publicOrderError(
      400,
      'LOYALTY_REWARD_UNAVAILABLE',
      'Récompense fidélité indisponible'
    );
  }
  // Date de retrait trop proche pour un article exigeant une commande à
  // l'avance (voir lib/orders.ts).
  if (err instanceof AdvanceOrderRequiredError) {
    return publicOrderError(400, 'ADVANCE_ORDER_REQUIRED', err.message, {
      requiredDays: err.requiredDays,
    });
  }
  // Article hors planning récurrent / fenêtre « spécialité de la semaine ».
  if (err instanceof ScheduleUnavailableError) {
    return publicOrderError(400, 'SCHEDULE_UNAVAILABLE', err.message, {
      productName: err.productName,
    });
  }
  // Article épuisé et retrait aujourd'hui : 409 = conflit avec l'état du
  // stock ; `items` liste les lignes fautives pour une résolution ligne à
  // ligne (remplacer / retirer / demain).
  if (err instanceof SoldOutTodayError) {
    return publicOrderError(409, 'SOLD_OUT_TODAY', err.message, {
      items: err.lines,
    });
  }
  // Paiement en ligne : le panier ne correspond plus au menu. 409 = conflit avec
  // l'état actuel ; `reason` dit au client s'il doit recharger son panier.
  if (err instanceof CartMismatchError) {
    return publicOrderError(409, 'CART_CHANGED', err.message, {
      reason: err.reason,
    });
  }
  // La commande ne peut plus être payée en ligne (déjà payée, expirée, annulée…).
  if (err instanceof PaymentNotPendingError) {
    return publicOrderError(
      err.reason === 'not_found' ? 404 : 409,
      err.reason === 'not_found' ? 'NOT_FOUND' : 'CONFLICT',
      err.message,
      { reason: err.reason }
    );
  }
  // Panne ou refus du fournisseur : on journalise le détail côté serveur, jamais
  // vers le navigateur (clé API, magasin…).
  if (err instanceof JekoApiError) {
    console.error(`[${context}] Jèko ${err.status} ${err.code} :`, err.message);
    return publicOrderError(
      502,
      'PAYMENT_PROVIDER_ERROR',
      'Le paiement en ligne est momentanément indisponible'
    );
  }
  if (err instanceof OrderMutationError) {
    const code: CheckoutErrorCode =
      err.httpStatus === 404
        ? 'NOT_FOUND'
        : err.httpStatus === 409
          ? 'CONFLICT'
          : 'VALIDATION';
    return publicOrderError(err.httpStatus, code, err.message);
  }
  console.error(`[${context}]`, err);
  return publicOrderError(500, 'SERVER_ERROR', 'Erreur serveur');
}
