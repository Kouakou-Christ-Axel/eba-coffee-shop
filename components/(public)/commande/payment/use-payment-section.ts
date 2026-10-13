'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { PublicOrderView } from '@/lib/orders';
import { priceFormatter } from '@/config/menu';
import { buildWhatsAppLink } from '@/lib/contact-links';
import { deferredPickupLabel } from '@/lib/orders/scheduling';
import type { JekoPaymentMethod } from '@/lib/jeko/payment-methods';
import {
  getPaymentPanelKind,
  formatRetryDeadline,
  paymentStartErrorMessage,
  type PaymentReturn,
} from '@/lib/orders/payment-panel';
import { useNowTick } from '@/lib/hooks/use-now-tick';

// Pendant la confirmation, on relit le paiement chez Jèko toutes les 25 s (la route
// accepte 30 vérifications par 10 min et par commande) ; au bout de 45 s sans
// réponse définitive on propose de réessayer plutôt que de laisser attendre.
const VERIFY_INTERVAL_MS = 25_000;
const VERIFY_SLOW_AFTER_MS = 45_000;

// `true` côté client, `false` au rendu serveur : le compte à rebours dépend de
// l'heure du navigateur et ne doit pas se rendre côté serveur (mismatch
// d'hydratation).
const subscribeNoop = () => () => {};
const useMounted = () =>
  useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );

export type PaymentSectionState = ReturnType<typeof usePaymentSection>;

export function usePaymentSection({
  order,
  whatsapp,
  paymentReturn,
  onRefresh,
}: {
  order: PublicOrderView;
  whatsapp: string;
  paymentReturn: PaymentReturn;
  onRefresh: () => void;
}) {
  const mounted = useMounted();
  const now = useNowTick(1000);
  const [method, setMethod] = useState<JekoPaymentMethod | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remoteFailed, setRemoteFailed] = useState(false);
  const [slow, setSlow] = useState(false);

  const baseKind = getPaymentPanelKind(order, paymentReturn);
  const retryDeadline = formatRetryDeadline(order.payment.expiresAt);
  const msLeft =
    mounted && order.payment.expiresAt
      ? new Date(order.payment.expiresAt).getTime() - now.getTime()
      : null;
  // Le délai est écoulé côté navigateur avant que le serveur ne l'ait constaté.
  const expiredLocally =
    baseKind === 'pending' && msLeft !== null && msLeft <= 0;
  const kind = expiredLocally
    ? 'expired'
    : baseKind === 'verifying' && remoteFailed
      ? 'failed'
      : baseKind;

  // Quand le délai tombe, on laisse le serveur constater (il annulera au prochain
  // passage) et on relit l'état.
  useEffect(() => {
    if (expiredLocally) onRefresh();
  }, [expiredLocally, onRefresh]);

  // ── Confirmation au retour de chez Jèko ──────────────────────────────────
  const verify = useCallback(async () => {
    try {
      const res = await fetch(`/api/commandes/${order.id}/paiement/verifier`, {
        method: 'POST',
      });
      if (!res.ok) return; // Jèko ou le réseau : on retentera au prochain tour.
      const data = (await res.json()) as { status?: string };
      if (data.status === 'success') onRefresh();
      if (data.status === 'error') setRemoteFailed(true);
    } catch {
      // Réseau instable : on retentera.
    }
  }, [order.id, onRefresh]);

  const verifying = kind === 'verifying';
  useEffect(() => {
    if (!verifying) return;
    // Première vérification tout de suite, mais depuis un rappel : lancer
    // `verify()` dans le corps de l'effet déclencherait un `setState`
    // synchrone (règle react-hooks/set-state-in-effect).
    const first = setTimeout(() => void verify(), 0);
    const poll = setInterval(() => void verify(), VERIFY_INTERVAL_MS);
    const slowTimer = setTimeout(() => setSlow(true), VERIFY_SLOW_AFTER_MS);
    return () => {
      clearTimeout(first);
      clearInterval(poll);
      clearTimeout(slowTimer);
    };
  }, [verifying, verify]);

  // ── Payer / réessayer ────────────────────────────────────────────────────
  async function pay() {
    if (!method) {
      setError('Choisis un moyen de paiement.');
      return;
    }
    setError(null);
    setStarting(true);
    try {
      const res = await fetch(`/api/commandes/${order.id}/paiement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod: method }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        code?: string;
        reason?: string;
        paymentUrl?: string;
      };
      if (!res.ok || !data.paymentUrl) {
        setError(paymentStartErrorMessage(res.status, data));
        // La commande a pu expirer ou être réglée entre-temps : on relit l'état.
        if (data.code === 'CONFLICT') onRefresh();
        setStarting(false);
        return;
      }
      // On part chez Jèko (autre site) : navigation « dure », le bouton reste
      // occupé jusqu'au changement de page.
      window.location.assign(data.paymentUrl);
    } catch {
      setError(paymentStartErrorMessage(0, {}));
      setStarting(false);
    }
  }

  const deferred = deferredPickupLabel(order, new Date());
  const deferredText = deferred
    ? `${deferred.day} pour ton retrait à ${deferred.time}`
    : null;
  const { amountDue, onlineFee } = order.payment;
  const depositOutstanding =
    order.depositRequired != null &&
    (order.depositPaid ?? 0) < order.depositRequired;
  const lateWhatsApp = buildWhatsAppLink(
    whatsapp,
    `Bonjour, j'ai payé ${priceFormatter.format(order.total + (onlineFee ?? 0))} F en ligne pour la commande ${order.reference}, mais elle apparaît annulée. Pouvez-vous la rétablir ?`
  );

  return {
    kind,
    msLeft,
    slow,
    retryDeadline,
    deferredText,
    depositOutstanding,
    lateWhatsApp,
    method,
    setMethod,
    starting,
    error,
    setError,
    pay,
    amountDue,
    onlineFee,
  };
}
