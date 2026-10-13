'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { PublicOrderView } from '@/lib/orders';
import type { PaymentReturn } from '@/lib/orders/payment-panel';
import { cartItemToAnalyticsItem, trackPurchase } from '@/lib/analytics';
import { getPickupCode } from '@/lib/orders/format';
import {
  ORDER_TRACKING_POLL_FAST_INTERVAL_MS,
  ORDER_TRACKING_POLL_INTERVAL_MS,
} from '@/config/constants';

// window.location.href via useSyncExternalStore : l'URL ne change jamais sur
// cette page (pas de navigation interne), l'abonnement est donc un no-op.
const subscribeNoop = () => () => {};
const getLocationHref = () => window.location.href;
const getEmptyString = () => '';

export function useOrderTracking(
  initialOrder: PublicOrderView,
  paymentReturn: PaymentReturn
) {
  const [order, setOrder] = useState<PublicOrderView>(initialOrder);
  // URL de suivi, indisponible au rendu serveur (snapshot '') — partagée
  // entre le partage du lien (code de retrait) et le bloc livreur.
  const trackingUrl = useSyncExternalStore(
    subscribeNoop,
    getLocationHref,
    getEmptyString
  );

  const isCancelled = order.status === 'CANCELLED';
  // Annulée faute de paiement dans les temps : le message le dit, le client n'a
  // rien été débité.
  const paymentExpired =
    isCancelled && !order.isPaid && order.payment.state === 'expired';
  const isFinal = order.status === 'COMPLETED' || isCancelled;
  const pickupCode = getPickupCode(order.reference);
  // Le stock n'est réservé qu'à l'ENTRÉE EN CUISINE (voir
  // lib/orders/availability.ts) : d'ici là, un article peut devenir
  // indisponible (un autre client a pris la dernière unité). Une commande
  // pour un autre jour n'est jamais signalée : son stock sera celui du jour J.
  const hasUnavailableItem = !order.isPaid && !order.fulfillable;

  // ── Polling léger : statut/paiement/livreur en direct tant que la commande
  //    est active ; pause quand l'onglet est masqué, refresh au retour.
  const refresh = useCallback(async () => {
    if (typeof document !== 'undefined' && document.hidden) return;
    try {
      const res = await fetch(`/api/commandes/${initialOrder.id}`, {
        cache: 'no-store',
      });
      if (!res.ok) return;
      setOrder((await res.json()) as PublicOrderView);
    } catch {
      // Réseau instable : on retentera au tick suivant.
    }
  }, [initialOrder.id]);

  // Paiement en ligne en cours : polling accéléré pour que le moment « payé »
  // (qui débloque la préparation) se voie vite.
  const awaitingOnlinePayment = order.payment.state === 'pending';

  // Le paiement bloque la préparation → on remonte le bloc au-dessus du code
  // de retrait. Total nul (récompense couvrant tout) : rien ne bloque.
  const paymentBlocking =
    !order.isPaid && order.status === 'NEW' && order.total > 0;

  useEffect(() => {
    if (isFinal) return;
    const timer = setInterval(
      refresh,
      awaitingOnlinePayment
        ? ORDER_TRACKING_POLL_FAST_INTERVAL_MS
        : ORDER_TRACKING_POLL_INTERVAL_MS
    );
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [refresh, isFinal, awaitingOnlinePayment]);

  // Conversion GA4 d'une commande en ligne : AU PAIEMENT, pas à la création (une
  // commande abandonnée ne doit pas compter). Une seule fois par commande et par
  // onglet, et seulement au retour de chez Jèko.
  const purchaseTrackable =
    order.isPaid && order.payment.onlineFee !== null && paymentReturn === 'ok';
  useEffect(() => {
    if (!purchaseTrackable) return;
    const key = `eba-purchase-tracked-${order.id}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, '1');
    } catch {
      // sessionStorage indisponible : au pire l'événement part une fois de plus.
    }
    trackPurchase({
      transactionId: order.reference,
      value: order.total,
      items: order.items.map(cartItemToAnalyticsItem),
    });
  }, [purchaseTrackable, order.id, order.reference, order.total, order.items]);

  return {
    order,
    refresh,
    trackingUrl,
    isCancelled,
    paymentExpired,
    isFinal,
    pickupCode,
    hasUnavailableItem,
    paymentBlocking,
  };
}
