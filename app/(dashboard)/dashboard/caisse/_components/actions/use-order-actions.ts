'use client';

import { useState } from 'react';
import type { OrderStatus } from '@/generated/prisma/client';
import { priceFormatter } from '@/config/menu';
import type { CashierOrder } from '@/lib/cashier-queue';
import { useUndoToast } from '@/lib/hooks/use-undo-toast';
import { formatPickup } from '@/lib/orders/scheduling';
import { useConfirmDialog } from '../../../_components/use-confirm-dialog';
import { useShortageConfirm } from '../../../_components/use-shortage-confirm';
import type { PaymentLine } from '../../payment-modal';
import { callApi, undoableStatusMessage } from './call-api';
import type { OrderView } from './use-order-view';

export function useOrderActions(order: CashierOrder, view: OrderView) {
  const { orderRef, tickNow, isDeferred } = view;
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  // Mutation en cours (null = aucune) : un verrou évite les 409 de concurrence optimiste, et seul le bouton actionné affiche l'attente.
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const isPending = pendingAction !== null;

  function runMutation(key: string, fn: () => Promise<void>) {
    if (pendingAction !== null) return;
    setPendingAction(key);
    void fn().finally(() => setPendingAction(null));
  }
  const [actionError, setActionError] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isEditFulfillmentOpen, setIsEditFulfillmentOpen] = useState(false);
  const [isEditCustomerOpen, setIsEditCustomerOpen] = useState(false);
  const [isEditLoyaltyOpen, setIsEditLoyaltyOpen] = useState(false);
  const { pushUndo } = useUndoToast();
  const { confirm, confirmDialog } = useConfirmDialog();
  const { confirmShortage, shortageDialog } = useShortageConfirm();

  // Undo 10 s : dépaye, et renvoie la commande à NEW si l'encaissement l'a aussi envoyée en cuisine.
  function pushPaymentUndo(startedPreparation: boolean) {
    pushUndo({
      message: `Commande ${orderRef} encaissée`,
      onUndo: async () => {
        const undoResult = await callApi(
          `/api/caisse/orders/${order.id}/payment`,
          'PATCH',
          { isPaid: false }
        );
        if (!undoResult.ok) throw new Error(undoResult.error);
        if (startedPreparation) {
          const statusResult = await callApi(
            `/api/caisse/orders/${order.id}/status`,
            'PATCH',
            { status: 'NEW' }
          );
          if (!statusResult.ok) throw new Error(statusResult.error);
        }
      },
    });
  }

  // En cas de pénurie, propose d'enregistrer la production sur place puis réessaie avec `coverShortage`.
  async function withShortageRetry<T>(
    call: (
      coverShortage: boolean
    ) => Promise<Awaited<ReturnType<typeof callApi<T>>>>
  ) {
    const first = await call(false);
    if (first.ok || !first.shortage?.length) return first;
    if (!(await confirmShortage(first.shortage))) return first;
    return call(true);
  }

  function handlePaymentConfirm(payments: PaymentLine[]) {
    setPaymentError(null);
    runMutation('payment', async () => {
      const result = await withShortageRetry<{ startedPreparation: boolean }>(
        (coverShortage) =>
          callApi(`/api/caisse/orders/${order.id}/payment`, 'PATCH', {
            isPaid: true,
            payments,
            ...(coverShortage ? { coverShortage: true } : {}),
          })
      );
      if (!result.ok) {
        setPaymentError(result.error);
        return;
      }
      setIsPaymentOpen(false);
      pushPaymentUndo(result.data.startedPreparation);
    });
  }

  // Encaisse l'acompte minimum sans solder ni lancer la cuisine : `sendOrderToKitchen` vérifie ensuite qu'il est couvert.
  function handleDepositConfirm(payments: PaymentLine[]) {
    setDepositError(null);
    runMutation('deposit', async () => {
      const result = await callApi(
        `/api/caisse/orders/${order.id}/deposit`,
        'PATCH',
        { payments }
      );
      if (!result.ok) {
        setDepositError(result.error);
        return;
      }
      setIsDepositOpen(false);
    });
  }

  // Preuve Wave envoyée depuis la page de suivi : encaissement direct en mode WAVE.
  function handleValidateWaveProof() {
    setActionError(null);
    runMutation('wave-proof', async () => {
      const result = await withShortageRetry<{ startedPreparation: boolean }>(
        (coverShortage) =>
          callApi(`/api/caisse/orders/${order.id}/payment`, 'PATCH', {
            isPaid: true,
            payments: [
              {
                mode: 'WAVE',
                amount: order.total - (order.depositPaid ?? 0),
              },
            ],
            ...(coverShortage ? { coverShortage: true } : {}),
          })
      );
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      pushPaymentUndo(result.data.startedPreparation);
    });
  }

  // `skipUndo` : pas de nouveau toast d'undo pour un undo. `onAccount` : envoi « ardoise » (cuisine sans encaissement, `isPaid` intact).
  function handleStatusChange(
    newStatus: OrderStatus,
    opts?: { skipUndo?: boolean; onAccount?: boolean }
  ) {
    setActionError(null);
    const previousStatus = order.status;
    const wasPaid = order.isPaid;
    runMutation(`status:${newStatus}`, async () => {
      const result = await withShortageRetry((coverShortage) =>
        callApi(`/api/caisse/orders/${order.id}/status`, 'PATCH', {
          status: newStatus,
          ...(opts?.onAccount ? { onAccount: true } : {}),
          ...(coverShortage ? { coverShortage: true } : {}),
        })
      );
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      if (opts?.skipUndo) return;
      const message = undoableStatusMessage(newStatus, wasPaid, orderRef);
      if (!message) return;
      pushUndo({
        message,
        onUndo: async () => {
          const undoResult = await callApi(
            `/api/caisse/orders/${order.id}/status`,
            'PATCH',
            { status: previousStatus }
          );
          if (!undoResult.ok) throw new Error(undoResult.error);
        },
      });
    });
  }

  function handleDismissDriverRequest() {
    setActionError(null);
    runMutation('driver', async () => {
      const result = await callApi(
        `/api/caisse/orders/${order.id}/driver-request`,
        'PATCH',
        { requested: false }
      );
      if (!result.ok) setActionError(result.error);
    });
  }

  // Lance une commande programmée déjà payée ; confirmation si le retrait est un autre jour (le stock d'AUJOURD'HUI sera décompté).
  async function handleStartPreparation() {
    if (isDeferred) {
      const confirmed = await confirm({
        title: 'Lancer maintenant ?',
        message: `Retrait ${formatPickup(order.pickupTime as Date, tickNow)}. La préparation démarre aujourd'hui et le stock du jour sera décompté.`,
        confirmLabel: 'Lancer la préparation',
      });
      if (!confirmed) return;
    }
    handleStatusChange('PREPARING');
  }

  async function handleSendToKitchenWithoutPayment() {
    const confirmed = await confirm({
      title: 'Mettre sur l’ardoise ?',
      message:
        'La commande part en cuisine sans encaissement et reste NON PAYÉE : le montant dû restera visible dans « Ardoise » jusqu’au règlement.',
      confirmLabel: 'Mettre sur l’ardoise',
    });
    if (!confirmed) return;
    handleStatusChange('PREPARING', { onAccount: true });
  }

  // Annule l'encaissement posé par l'ancienne pré-analyse IA (commandes historiques) : touche `isPaid` seulement, jamais le statut.
  async function handleUndoAutoValidation() {
    const confirmed = await confirm({
      title: 'Annuler l’encaissement IA ?',
      message: `La commande ${orderRef} repassera « non payée ».`,
      confirmLabel: 'Annuler l’encaissement',
      destructive: true,
    });
    if (!confirmed) return;
    setActionError(null);
    runMutation('undo-ai', async () => {
      const result = await callApi(
        `/api/caisse/orders/${order.id}/payment`,
        'PATCH',
        { isPaid: false }
      );
      if (!result.ok) setActionError(result.error);
    });
  }

  // Annule une commande non payée ; rembourse (= annule) une commande payée.
  async function handleCancelOrRefund() {
    const confirmed = await confirm(
      order.isPaid
        ? {
            title: 'Rembourser et annuler ?',
            message: `Le montant de ${priceFormatter.format(order.total)} F sera rendu au client pour la commande ${orderRef}.`,
            confirmLabel: 'Rembourser et annuler',
            destructive: true,
          }
        : {
            title: 'Annuler la commande ?',
            message: `La commande ${orderRef} sera annulée.`,
            confirmLabel: 'Annuler la commande',
            cancelLabel: 'Revenir',
            destructive: true,
          }
    );
    if (!confirmed) return;
    handleStatusChange('CANCELLED');
  }

  return {
    isPaymentOpen,
    setIsPaymentOpen,
    paymentError,
    setPaymentError,
    isDepositOpen,
    setIsDepositOpen,
    depositError,
    setDepositError,
    pendingAction,
    isPending,
    actionError,
    isEditOpen,
    setIsEditOpen,
    isEditFulfillmentOpen,
    setIsEditFulfillmentOpen,
    isEditCustomerOpen,
    setIsEditCustomerOpen,
    isEditLoyaltyOpen,
    setIsEditLoyaltyOpen,
    confirmDialog,
    shortageDialog,
    handlePaymentConfirm,
    handleDepositConfirm,
    handleValidateWaveProof,
    handleStatusChange,
    handleDismissDriverRequest,
    handleStartPreparation,
    handleSendToKitchenWithoutPayment,
    handleUndoAutoValidation,
    handleCancelOrRefund,
  };
}

export type OrderActions = ReturnType<typeof useOrderActions>;
