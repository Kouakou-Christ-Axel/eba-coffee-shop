'use client';

// Boutons du détail d'un remboursement, selon son statut et le rôle. Le serveur
// refait chaque contrôle (rôle, statut, plafond) : ici on ne masque que ce qui
// produirait un refus.

import { useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useConfirmDialog } from '../../_components/use-confirm-dialog';
import { describeTransferFailure } from '@/lib/jeko/transfer-errors';
import { REFUND_DELIVERY_LABELS } from '@/lib/refunds/labels';
import {
  approveRefundAction,
  cancelRefundAction,
  markRefundPaidAction,
  rejectRefundAction,
  resolveUncertainRefundAction,
  retryRefundAction,
  type RefundActionResult,
} from '../actions';
import { EditDestination } from './edit-destination';
import type { RefundDetailData, RefundViewer } from './refund-types';

const fmt = new Intl.NumberFormat('fr-FR');

export function RefundActions({
  refund,
  viewer,
  onDone,
}: {
  refund: RefundDetailData;
  viewer: RefundViewer;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const { confirm, confirmDialog } = useConfirmDialog();
  const { status, delivery } = refund;
  const advice = describeTransferFailure(refund.failureCode);
  const mine = viewer.canRequest && refund.requestedById === viewer.userId;

  function run(fn: () => Promise<RefundActionResult>) {
    setFeedback(null);
    startTransition(async () => {
      const r = await fn();
      if (r.ok) {
        setFeedback({ ok: true, text: r.message ?? 'Fait.' });
        onDone();
      } else {
        setFeedback({ ok: false, text: r.error });
      }
    });
  }

  async function approve() {
    const how =
      delivery === 'JEKO_TRANSFER'
        ? `Le transfert Jèko de ${fmt.format(refund.amount)} F part immédiatement vers ${refund.phone ?? 'le numéro indiqué'}.`
        : `${fmt.format(refund.amount)} F seront à remettre au client.`;
    if (
      await confirm({
        title: 'Valider le remboursement',
        message: how,
        confirmLabel: 'Valider',
      })
    ) {
      run(() => approveRefundAction(refund.id));
    }
  }

  async function markPaid(text: string, label: string) {
    if (await confirm({ title: label, message: text, confirmLabel: label })) {
      run(() => markRefundPaidAction(refund.id));
    }
  }

  const canEdit =
    viewer.canRequest &&
    ['REQUESTED', 'APPROVED', 'FAILED'].includes(status) &&
    refund.source === 'STAFF';
  const canCancel =
    (viewer.canApprove || mine) &&
    ['REQUESTED', 'APPROVED', 'FAILED'].includes(status) &&
    refund.source === 'STAFF';

  return (
    <div className="space-y-3">
      {status === 'FAILED' && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <p className="font-semibold text-destructive">{advice.message}</p>
          <p className="mt-1 text-muted-foreground">{advice.action}</p>
          {refund.failureMessage &&
            refund.failureMessage !== advice.message && (
              <p className="mt-1 text-xs text-muted-foreground">
                Détail : {refund.failureMessage}
              </p>
            )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {status === 'REQUESTED' && viewer.canApprove && (
          <Button disabled={pending} onClick={approve}>
            {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Valider et {delivery === 'JEKO_TRANSFER' ? 'envoyer' : 'accepter'}
          </Button>
        )}
        {status === 'APPROVED' &&
          delivery === 'MANUAL' &&
          viewer.canRequest && (
            <Button
              disabled={pending}
              onClick={() =>
                markPaid(
                  `Confirmez avoir remis ${fmt.format(refund.amount)} F au client. Le tiroir et les statistiques en tiennent compte dès maintenant.`,
                  'Remis au client'
                )
              }
            >
              Remis au client
            </Button>
          )}
        {status === 'FAILED' && viewer.canApprove && advice.retryable && (
          <Button
            disabled={pending}
            onClick={() => run(() => retryRefundAction(refund.id))}
          >
            Réessayer
          </Button>
        )}
        {status === 'FAILED' && viewer.canApprove && (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() =>
              markPaid(
                'Utilisez ceci seulement si vous avez remboursé le client vous-même (Dashboard Jèko, espèces…).',
                'Réglé hors application'
              )
            }
          >
            Réglé hors application
          </Button>
        )}
        {status === 'UNCERTAIN' && viewer.canApprove && (
          <>
            <Button
              disabled={pending}
              onClick={() =>
                run(() => resolveUncertainRefundAction(refund.id, 'SENT'))
              }
            >
              Vérifié : envoyé
            </Button>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() =>
                run(() => resolveUncertainRefundAction(refund.id, 'NOT_SENT'))
              }
            >
              Vérifié : pas envoyé
            </Button>
          </>
        )}
        {['REQUESTED', 'APPROVED', 'FAILED'].includes(status) &&
          viewer.canApprove &&
          refund.source === 'STAFF' && (
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setRejecting((v) => !v)}
            >
              Refuser
            </Button>
          )}
        {canCancel && (
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => run(() => cancelRefundAction(refund.id))}
          >
            Annuler la demande
          </Button>
        )}
      </div>

      {rejecting && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Motif du refus (facultatif)"
            className="max-w-xs"
          />
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() => run(() => rejectRefundAction(refund.id, note))}
          >
            Confirmer le refus
          </Button>
        </div>
      )}

      {canEdit && (
        <EditDestination
          refund={refund}
          disabled={pending}
          editableHint={
            status === 'FAILED' && advice.editable
              ? 'Le numéro ou le moyen est peut-être en cause.'
              : undefined
          }
          onDone={(r) => {
            setFeedback(
              r.ok
                ? { ok: true, text: r.message ?? 'Corrigé.' }
                : { ok: false, text: r.error }
            );
            if (r.ok) onDone();
          }}
        />
      )}

      {status === 'PAID' && (
        <p className="text-sm text-muted-foreground">
          {REFUND_DELIVERY_LABELS[delivery]} · l’argent est parti.
        </p>
      )}
      {feedback && (
        <p
          role="status"
          className={
            feedback.ok ? 'text-sm text-green-700' : 'text-sm text-destructive'
          }
        >
          {feedback.text}
        </p>
      )}
      {confirmDialog}
    </div>
  );
}
