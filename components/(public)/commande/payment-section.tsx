'use client';

// components/(public)/commande/payment-section.tsx
//
// Bloc « Paiement » de la page publique de suivi (/commande/:id). Le client paie
// en ligne via Jèko (Wave, Orange, MTN, Moov, Djamo) puis revient ici. La logique
// de décision (quel état, compte à rebours, messages) vit dans
// lib/orders/payment-panel.ts, testée ; ce composant n'ajoute que le JSX et les
// appels réseau.
//
// États (cf. `PaymentPanelKind`) :
//   - pending      : compte à rebours, choix du moyen, « Payer … F » ;
//   - verifying    : de retour de chez Jèko avec succès, on confirme ;
//   - failed       : retour avec échec, le client peut réessayer ;
//   - expired      : délai dépassé, il faut recommander ;
//   - paid / late_paid / nothing_due / deposit_paid : issues positives ;
//   - counter      : aucun paiement en ligne, on règle au comptoir.

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Button, Chip } from '@heroui/react';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import {
  CheckCircle2,
  Clock,
  Gift,
  Loader2,
  MessageCircle,
  Wallet,
  XCircle,
} from 'lucide-react';
import type { PublicOrderView } from '@/lib/orders';
import { priceFormatter } from '@/config/menu';
import { buildWhatsAppLink } from '@/lib/contact-links';
import { deferredPickupLabel } from '@/lib/orders/scheduling';
import {
  JEKO_PAYMENT_METHODS,
  type JekoPaymentMethod,
} from '@/lib/jeko/payment-methods';
import {
  formatCountdown,
  getPaymentPanelKind,
  paymentStartErrorMessage,
  type PaymentReturn,
} from '@/lib/orders/payment-panel';
import { useNowTick } from '@/lib/hooks/use-now-tick';
import { PaymentMethodPicker } from '@/components/(public)/carte/_components/payment-method-picker';

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

function Panel({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <m.div
      key={id}
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={className}
    >
      {children}
    </m.div>
  );
}

const SUCCESS_BOX =
  'mt-4 flex items-center gap-3 rounded-lg bg-success/15 px-3 py-3';
const SUCCESS_TEXT = 'text-sm font-medium text-success-700 dark:text-success';

export function PaymentSection({
  order,
  whatsapp,
  paymentReturn,
  onRefresh,
}: {
  order: PublicOrderView;
  whatsapp: string;
  /** Retour de chez Jèko lu dans `?paiement=` (null = arrivée normale). */
  paymentReturn: PaymentReturn;
  /** Recharge la commande (après une vérification ou un paiement relancé). */
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

  const picker = (
    <div className="mt-4 flex flex-col gap-3">
      <PaymentMethodPicker
        methods={[...JEKO_PAYMENT_METHODS]}
        value={method}
        onChange={(mth) => {
          setMethod(mth);
          setError(null);
        }}
      />
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <Button
        color="primary"
        size="lg"
        className="w-full"
        isLoading={starting}
        isDisabled={starting}
        onPress={() => void pay()}
      >
        Payer {priceFormatter.format(amountDue)} F
      </Button>
      {onlineFee != null && onlineFee > 0 && (
        <p className="text-center text-xs text-foreground/50">
          Dont {priceFormatter.format(onlineFee)} F de frais de paiement en
          ligne.
        </p>
      )}
    </div>
  );

  return (
    <div className="rounded-xl border border-foreground/10 bg-default-50 p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground/40">
          <Wallet className="h-4 w-4" />
          Paiement
        </p>
        {kind === 'paid' ||
        kind === 'deposit_paid' ||
        kind === 'nothing_due' ? (
          <Chip color="success" variant="flat" size="sm">
            {kind === 'paid'
              ? 'Paiement validé'
              : kind === 'deposit_paid'
                ? 'Acompte versé'
                : 'Rien à payer'}
          </Chip>
        ) : kind === 'late_paid' ? (
          <Chip color="warning" variant="flat" size="sm">
            Payée, commande annulée
          </Chip>
        ) : kind === 'failed' || kind === 'expired' ? (
          <Chip color="danger" variant="flat" size="sm">
            {kind === 'expired' ? 'Délai dépassé' : 'Paiement échoué'}
          </Chip>
        ) : kind === 'verifying' ? (
          <Chip color="warning" variant="flat" size="sm">
            Confirmation en cours
          </Chip>
        ) : (
          <Chip color="default" variant="flat" size="sm">
            En attente
          </Chip>
        )}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {kind === 'paid' ? (
          <Panel id="paid" className={SUCCESS_BOX}>
            <CheckCircle2 className="h-6 w-6 shrink-0 text-success-700 dark:text-success" />
            <p className={SUCCESS_TEXT}>
              {deferredText
                ? `Paiement validé 🎉 — ta commande sera préparée ${deferredText}.`
                : 'Paiement validé 🎉 — ta commande part en préparation.'}
            </p>
          </Panel>
        ) : kind === 'late_paid' ? (
          <Panel id="late-paid" className="mt-4 flex flex-col gap-3">
            <p className="rounded-lg bg-warning/15 px-3 py-3 text-sm font-medium text-warning-700 dark:text-warning">
              Ton paiement est bien reçu, mais la commande avait expiré avant
              qu’il n’arrive. Le comptoir va la rétablir ou te rembourser : ne
              repaie surtout pas.
            </p>
            {lateWhatsApp && (
              <Button
                as="a"
                href={lateWhatsApp}
                target="_blank"
                rel="noopener noreferrer"
                variant="bordered"
                size="lg"
                startContent={<MessageCircle className="h-4 w-4" />}
              >
                Prévenir le comptoir sur WhatsApp
              </Button>
            )}
          </Panel>
        ) : kind === 'nothing_due' ? (
          <Panel id="nothing-due" className={SUCCESS_BOX}>
            <Gift className="h-6 w-6 shrink-0 text-success-700 dark:text-success" />
            <p className={SUCCESS_TEXT}>
              Rien à payer 🎉 — ta récompense fidélité couvre toute la commande.
            </p>
          </Panel>
        ) : kind === 'deposit_paid' ? (
          <Panel id="deposit-paid" className={SUCCESS_BOX}>
            <CheckCircle2 className="h-6 w-6 shrink-0 text-success-700 dark:text-success" />
            <p className={SUCCESS_TEXT}>
              Acompte reçu ✓ — le solde de{' '}
              {priceFormatter.format(order.total - (order.depositPaid ?? 0))} F
              se règle au comptoir, au retrait.
            </p>
          </Panel>
        ) : kind === 'verifying' ? (
          <Panel id="verifying" className="mt-4 flex flex-col gap-3">
            <div className="flex items-center gap-3 rounded-lg bg-warning/15 px-3 py-3">
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-warning-700 dark:text-warning" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-warning-700 dark:text-warning">
                  On vérifie ton paiement…
                </p>
                <p className="mt-0.5 text-xs text-foreground/60">
                  Quelques secondes — cette page se met à jour toute seule.
                </p>
              </div>
            </div>
            {slow && (
              <>
                <p className="text-sm text-foreground/60">
                  La confirmation prend plus de temps que prévu. Si tu n’as pas
                  été débité, tu peux réessayer :
                </p>
                {picker}
              </>
            )}
          </Panel>
        ) : kind === 'failed' ? (
          <Panel id="failed" className="mt-4 flex flex-col gap-3">
            <p className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-3 text-sm font-medium text-danger">
              <XCircle className="h-4 w-4 shrink-0" />
              Le paiement n’a pas abouti. Tu n’as pas été débité : tu peux
              réessayer, avec le même moyen ou un autre.
            </p>
            {picker}
          </Panel>
        ) : kind === 'expired' ? (
          <Panel id="expired" className="mt-4 flex flex-col gap-3">
            <p className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-3 text-sm font-medium text-danger">
              <XCircle className="h-4 w-4 shrink-0" />
              Le délai de paiement est dépassé : cette commande a expiré. Rien
              n’a été débité.
            </p>
            <Button as={Link} href="/carte" color="primary" size="lg">
              Commander à nouveau
            </Button>
          </Panel>
        ) : kind === 'pending' ? (
          <Panel id="pending" className="mt-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3 rounded-lg bg-warning/15 px-3 py-3">
              <p className="text-sm font-medium text-warning-700 dark:text-warning">
                {deferredText
                  ? `Paye maintenant pour réserver ta commande : elle sera préparée ${deferredText}.`
                  : 'Ta commande part en préparation dès que le paiement est confirmé.'}
              </p>
              {msLeft !== null && (
                <span
                  className="flex shrink-0 items-center gap-1 font-mono text-sm font-semibold text-warning-700 dark:text-warning"
                  aria-label="Temps restant pour payer"
                >
                  <Clock className="h-4 w-4" aria-hidden="true" />
                  {formatCountdown(msLeft)}
                </span>
              )}
            </div>
            {picker}
          </Panel>
        ) : (
          <Panel id="counter" className="mt-4 flex flex-col gap-3">
            <p className="rounded-lg bg-warning/15 px-3 py-2 text-sm font-medium text-warning-700 dark:text-warning">
              {depositOutstanding
                ? `Commande spéciale : un acompte de ${priceFormatter.format(order.depositRequired! - (order.depositPaid ?? 0))} F est à régler au comptoir pour la prise en compte.`
                : 'Paye au comptoir à la récupération (espèces ou mobile money) — rien d’autre à faire ici.'}
            </p>
          </Panel>
        )}
      </AnimatePresence>
    </div>
  );
}
