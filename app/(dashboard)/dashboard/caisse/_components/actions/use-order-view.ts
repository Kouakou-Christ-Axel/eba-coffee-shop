'use client';

import {
  buildPickupReadyMessage,
  buildTelLink,
  buildWaveRequestMessage,
  buildWhatsAppLink,
} from '@/lib/contact-links';
import type { CashierOrder } from '@/lib/cashier-queue';
import { isDeferredPickup } from '@/lib/orders/scheduling';
import { useNowTick } from '../../use-now-tick';
import type { CaisseContactSettings } from './types';

export function useOrderView(
  order: CashierOrder,
  contactSettings: CaisseContactSettings
) {
  // Horloge qui tique : le verdict « différée » change à minuit, que le SSE ne signale pas.
  const tickNow = useNowTick();

  const canEditItems =
    order.status !== 'COMPLETED' && order.status !== 'CANCELLED';
  // Récompense fidélité modifiable même sur une commande terminée ; seule l'annulée est bloquée (cf. `setOrderLoyaltyReward`).
  const canEditLoyalty = order.status !== 'CANCELLED';

  const phone = order.customerPhone;
  const telLink = buildTelLink(phone);
  const trackingUrl =
    typeof window === 'undefined'
      ? undefined
      : `${window.location.origin}/commande/${order.id}`;
  // Incitation fidélité : seulement pour un client identifié et si le programme est actif.
  const loyaltyTeaser =
    order.customerId && order.loyaltyStampCount !== null
      ? { settings: order.loyaltySettings, stampCount: order.loyaltyStampCount }
      : null;
  const whatsappLink = buildWhatsAppLink(
    phone,
    buildWaveRequestMessage({
      customerName: order.customerName,
      dailyNumber: order.dailyNumber,
      reference: order.reference,
      amount: order.total,
      items: order.items,
      loyaltyDiscount: order.loyaltyDiscount,
      trackingUrl,
      loyaltyTeaser,
      ...contactSettings,
    })
  );
  const readyLink = buildWhatsAppLink(
    phone,
    buildPickupReadyMessage({
      dailyNumber: order.dailyNumber,
      reference: order.reference,
      yangoLandmark: contactSettings.yangoLandmark,
      mapsDirectionsUrl: contactSettings.mapsDirectionsUrl,
      trackingUrl,
      loyalty:
        order.customerId &&
        order.loyaltyStampCount !== null &&
        order.loyaltyPickupOutcome
          ? {
              settings: order.loyaltySettings,
              stampEarned: order.loyaltyPickupOutcome.stampEarned,
              isFirstStampEver: order.loyaltyPickupOutcome.isFirstStampEver,
              stampCount: order.loyaltyStampCount,
            }
          : null,
    })
  );

  const payLabel =
    order.status === 'PREPARING' ||
    order.status === 'READY' ||
    order.status === 'COMPLETED'
      ? 'Encaisser maintenant'
      : 'Marquer payée';

  // Acompte d'une commande spéciale (`Order.depositRequired`) restant à verser avant l'entrée en cuisine.
  const depositRemaining =
    order.depositRequired != null
      ? order.depositRequired - (order.depositPaid ?? 0)
      : 0;
  const needsDeposit = !order.isPaid && depositRemaining > 0;

  // Retrait un jour ultérieur : recalculé ici car le SSE ne repousse pas à minuit.
  const isDeferred = isDeferredPickup(order.pickupTime, tickNow);

  // Rupture signalée par le SSE sur une commande dont le stock n'est pas réservé (`stockReservedAt`, pas `isPaid` : l'ardoise l'a déjà).
  const hasStockShortage =
    order.stockShortage && order.stockReservedAt === null && !isDeferred;

  const orderRef = `#${String(order.dailyNumber).padStart(3, '0')}`;

  return {
    tickNow,
    canEditItems,
    canEditLoyalty,
    phone,
    telLink,
    trackingUrl,
    loyaltyTeaser,
    whatsappLink,
    readyLink,
    payLabel,
    depositRemaining,
    needsDeposit,
    isDeferred,
    hasStockShortage,
    orderRef,
  };
}

export type OrderView = ReturnType<typeof useOrderView>;
