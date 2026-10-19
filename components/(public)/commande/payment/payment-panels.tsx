'use client';

import Link from 'next/link';
import { Button } from '@heroui/react';
import { AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  Clock,
  Gift,
  Loader2,
  MessageCircle,
  XCircle,
} from 'lucide-react';
import type { PublicOrderView } from '@/lib/orders';
import { priceFormatter } from '@/config/menu';
import {
  formatCountdown,
  type PaymentReturn,
} from '@/lib/orders/payment-panel';
import { PaymentPicker } from './payment-picker';
import { Panel, SUCCESS_BOX, SUCCESS_TEXT } from './panel';
import type { PaymentSectionState } from './use-payment-section';

function expiredText(refund: PublicOrderView['payment']['refund']): string {
  if (!refund) {
    return 'Le délai de paiement est dépassé : cette commande a expiré. Rien n’a été débité.';
  }
  if (refund.status === 'done') {
    return `Ton paiement est arrivé après le délai et un article n’est plus disponible : ${refund.amount === null ? 'ton paiement a été remboursé' : `${priceFormatter.format(refund.amount)} F remboursés`} sur ton numéro.`;
  }
  return 'Ton paiement est arrivé après le délai et un article n’est plus disponible : nous te remboursons rapidement.';
}

export function PaymentPanels({
  order,
  paymentReturn,
  payment,
}: {
  order: PublicOrderView;
  paymentReturn: PaymentReturn;
  payment: PaymentSectionState;
}) {
  const {
    kind,
    msLeft,
    slow,
    retryDeadline,
    deferredText,
    depositOutstanding,
    lateWhatsApp,
  } = payment;
  return (
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
            {priceFormatter.format(order.total - (order.depositPaid ?? 0))} F se
            règle au comptoir, au retrait.
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
              <PaymentPicker payment={payment} />
            </>
          )}
        </Panel>
      ) : kind === 'failed' ? (
        <Panel id="failed" className="mt-4 flex flex-col gap-3">
          <p className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-3 text-sm font-medium text-danger">
            <XCircle className="h-4 w-4 shrink-0" />
            {paymentReturn === 'indisponible'
              ? 'Ta commande est enregistrée, mais le paiement en ligne n’a pas pu démarrer. Tu n’as pas été débité : réessaie dans un instant, avec le même moyen ou un autre.'
              : 'Le paiement n’a pas abouti. Tu n’as pas été débité : tu peux réessayer, avec le même moyen ou un autre.'}
            {retryDeadline && ` Tu peux réessayer jusqu’à ${retryDeadline}.`}
          </p>
          <PaymentPicker payment={payment} />
        </Panel>
      ) : kind === 'expired' ? (
        <Panel id="expired" className="mt-4 flex flex-col gap-3">
          <p className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-3 text-sm font-medium text-danger">
            <XCircle className="h-4 w-4 shrink-0" />
            {expiredText(order.payment.refund)}
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
          <PaymentPicker payment={payment} />
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
  );
}
