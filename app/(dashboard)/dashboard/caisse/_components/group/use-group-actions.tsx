'use client';

import { useMemo, useState } from 'react';
import type { OrderStatus } from '@/generated/prisma/client';
import {
  allocatePayments,
  remainingToPay,
  summarizeGroup,
  type CashierGroup,
  type PaymentLine,
} from '@/lib/cashier-queue/group';
import { orderRef } from '@/lib/orders/customer-groups';
import type { CashierOrder } from '@/lib/cashier-queue';
import {
  buildGroupDriverRequestMessage,
  buildWhatsAppLink,
} from '@/lib/contact-links';
import { useUndoToast } from '@/lib/hooks/use-undo-toast';
import { useConfirmDialog } from '../../../_components/use-confirm-dialog';
import { useShortageConfirm } from '../../../_components/use-shortage-confirm';
import { callApi, withShortageRetry } from '../actions/call-api';
import type { CaisseContactSettings } from '../actions/types';

type Outcome = { done: CashierOrder[]; failed: string[] };

const refs = (orders: CashierOrder[]) => orders.map(orderRef).join(' · ');

/** Le livreur déjà connu sur le groupe, s'il est unique et complet (nom ET téléphone). */
function sharedDriver(orders: CashierOrder[]) {
  const known = new Map<string, { name: string; phone: string }>();
  for (const o of orders) {
    if (o.driverName && o.driverPhone) {
      known.set(`${o.driverName}|${o.driverPhone}`, {
        name: o.driverName,
        phone: o.driverPhone,
      });
    }
  }
  return known.size === 1 ? [...known.values()][0] : null;
}

/**
 * Actions en lot d'un groupe. Aucune logique métier ici : chaque commande passe
 * par les MÊMES routes que sa carte individuelle (paiement, statut, livreur),
 * l'une après l'autre. Un échec n'arrête pas les suivantes ; il est rapporté
 * commande par commande pour que le caissier sache exactement quoi reprendre.
 */
export function useGroupActions(
  group: CashierGroup,
  contactSettings: CaisseContactSettings
) {
  const summary = useMemo(() => summarizeGroup(group), [group]);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const { pushUndo } = useUndoToast();
  const { confirm, confirmDialog } = useConfirmDialog();
  const { confirmShortage, shortageDialog } = useShortageConfirm();

  function run(key: string, fn: () => Promise<void>) {
    if (pendingAction !== null) return;
    setPendingAction(key);
    setError(null);
    void fn().finally(() => setPendingAction(null));
  }

  function report(outcome: Outcome, verb: string): boolean {
    if (outcome.failed.length === 0) return true;
    const ok = outcome.done.length ? `${outcome.done.length} ${verb}. ` : '';
    setError(`${ok}À reprendre : ${outcome.failed.join(' ; ')}`);
    return false;
  }

  async function eachStatus(
    orders: CashierOrder[],
    status: OrderStatus
  ): Promise<Outcome> {
    const out: Outcome = { done: [], failed: [] };
    for (const o of orders) {
      const res = await withShortageRetry(
        (coverShortage) =>
          callApi(`/api/caisse/orders/${o.id}/status`, 'PATCH', {
            status,
            ...(coverShortage ? { coverShortage: true } : {}),
          }),
        confirmShortage
      );
      if (res.ok) out.done.push(o);
      else out.failed.push(`${orderRef(o)} (${res.error})`);
    }
    return out;
  }

  function undoStatus(orders: CashierOrder[], message: string) {
    pushUndo({
      message,
      onUndo: async () => {
        for (const o of orders) {
          const res = await callApi(
            `/api/caisse/orders/${o.id}/status`,
            'PATCH',
            {
              status: o.status,
            }
          );
          if (!res.ok) throw new Error(res.error);
        }
      },
    });
  }

  function handlePayAll(lines: PaymentLine[]) {
    setPayError(null);
    const targets = summary.payable.map((o) => ({
      orderId: o.id,
      amount: remainingToPay(o),
    }));
    const plan = allocatePayments(lines, targets);
    if (!plan) {
      setPayError('Le total saisi ne correspond pas au montant du groupe.');
      return;
    }
    run('pay', async () => {
      const out: Outcome = { done: [], failed: [] };
      const started: string[] = [];
      for (const { orderId, payments } of plan) {
        const o = summary.payable.find((x) => x.id === orderId)!;
        const res = await withShortageRetry<{ startedPreparation: boolean }>(
          (coverShortage) =>
            callApi(`/api/caisse/orders/${orderId}/payment`, 'PATCH', {
              isPaid: true,
              payments,
              ...(coverShortage ? { coverShortage: true } : {}),
            }),
          confirmShortage
        );
        if (!res.ok) {
          out.failed.push(`${orderRef(o)} (${res.error})`);
          continue;
        }
        out.done.push(o);
        if (res.data.startedPreparation) started.push(orderId);
      }
      setIsPayOpen(false);
      if (out.done.length > 0) {
        pushUndo({
          message: `Groupe encaissé (${refs(out.done)})`,
          onUndo: async () => {
            for (const o of out.done) {
              const r = await callApi(
                `/api/caisse/orders/${o.id}/payment`,
                'PATCH',
                {
                  isPaid: false,
                }
              );
              if (!r.ok) throw new Error(r.error);
              if (started.includes(o.id)) {
                await callApi(`/api/caisse/orders/${o.id}/status`, 'PATCH', {
                  status: 'NEW',
                });
              }
            }
          },
        });
      }
      report(out, 'encaissée(s)');
    });
  }

  function handleMarkAllReady() {
    run('ready', async () => {
      const out = await eachStatus(summary.preparing, 'READY');
      if (out.done.length) {
        undoStatus(out.done, `Groupe prêt (${refs(out.done)})`);
      }
      report(out, 'prête(s)');
    });
  }

  async function handleCompleteAll() {
    const staying = group.orders.filter(
      (o) => !summary.handable.some((h) => h.id === o.id)
    );
    if (staying.length > 0) {
      const ok = await confirm({
        title: 'Remettre une partie du groupe ?',
        message: `${summary.handable.length} sur ${group.orders.length} sont remises. Restent au comptoir : ${refs(staying)} (pas encore prêtes ou impayées).`,
        confirmLabel: 'Remettre ces commandes',
      });
      if (!ok) return;
    }
    run('complete', async () => {
      const out = await eachStatus(summary.handable, 'COMPLETED');
      if (out.done.length) {
        undoStatus(out.done, `Groupe récupéré (${refs(out.done)})`);
      }
      report(out, 'récupérée(s)');
    });
  }

  const driverLink = buildWhatsAppLink(
    group.customerPhone,
    buildGroupDriverRequestMessage({
      customerName: group.customerName,
      dailyNumbers: summary.deliveries.map((o) => o.dailyNumber),
      yangoLandmark: contactSettings.yangoLandmark,
      phone: contactSettings.phone,
    })
  );

  /** Pose « livreur demandé » sur tout le groupe d'un coup (un seul message au client). */
  function handleRequestDriverAll() {
    run('driver', async () => {
      const out: Outcome = { done: [], failed: [] };
      for (const o of summary.driverTargets) {
        const res = await callApi(
          `/api/caisse/orders/${o.id}/driver-request`,
          'PATCH',
          { requested: true }
        );
        // 409 « déjà à jour » : la cuisine l'avait posé, rien à signaler.
        if (res.ok || res.error.includes('déjà')) out.done.push(o);
        else out.failed.push(`${orderRef(o)} (${res.error})`);
      }
      report(out, 'demandée(s)');
    });
  }

  const driver = sharedDriver(group.orders);
  const withoutDriver = driver
    ? summary.deliveries.filter(
        (o) => o.driverName !== driver.name || o.driverPhone !== driver.phone
      )
    : [];

  /** Recopie le livreur connu sur les livraisons du groupe qui n'en ont pas (ou un autre). */
  function handleApplyDriver() {
    if (!driver) return;
    run('apply-driver', async () => {
      const out: Outcome = { done: [], failed: [] };
      for (const o of withoutDriver) {
        const res = await callApi(
          `/api/caisse/orders/${o.id}/fulfillment`,
          'PATCH',
          { driverName: driver.name, driverPhone: driver.phone }
        );
        if (res.ok) out.done.push(o);
        else out.failed.push(`${orderRef(o)} (${res.error})`);
      }
      report(out, 'mise(s) à jour');
    });
  }

  return {
    summary,
    pendingAction,
    isPending: pendingAction !== null,
    error,
    dismissError: () => setError(null),
    isPayOpen,
    setIsPayOpen,
    payError,
    handlePayAll,
    handleMarkAllReady,
    handleCompleteAll,
    driverLink,
    handleRequestDriverAll,
    driver,
    withoutDriver,
    handleApplyDriver,
    dialogs: (
      <>
        {confirmDialog}
        {shortageDialog}
      </>
    ),
  };
}

export type GroupActions = ReturnType<typeof useGroupActions>;
