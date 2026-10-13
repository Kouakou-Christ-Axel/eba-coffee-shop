'use client';

import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from '@heroui/react';
import { Plus } from 'lucide-react';
import { CashTenderPanel } from './_components/payment/cash-tender-panel';
import { priceFormatter } from './_components/payment/format';
import { SingleModeGrid } from './_components/payment/single-mode-grid';
import { SplitLines } from './_components/payment/split-lines';
import type { PaymentLine } from './_components/payment/types';
import { usePaymentForm } from './_components/payment/use-payment-form';

export type { PaymentLine } from './_components/payment/types';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  orderRef: string;
  amount: number;
  isSubmitting: boolean;
  onConfirm: (payments: PaymentLine[]) => void;
  error?: string | null;
};

/**
 * Modale d'encaissement. Chemin rapide inchangé pour le cas courant (un seul
 * moyen de paiement) : taper un moyen → « Marquer payée » activable
 * immédiatement, même nombre de taps qu'avant le paiement fractionné.
 * « + Ajouter un moyen de paiement » révèle une saisie fractionnée (montant
 * éditable par ligne + solde restant) — la confirmation reste bloquée tant
 * que la somme des lignes ne couvre pas exactement le montant.
 */
export function PaymentModal({
  isOpen,
  onClose,
  orderRef,
  amount,
  isSubmitting,
  onConfirm,
  error,
}: Props) {
  const form = usePaymentForm({ amount, isSubmitting, onClose, onConfirm });
  const {
    isSplit,
    canConfirm,
    showSingleGrid,
    showCashTender,
    handleClose,
    handleConfirm,
    startSplit,
  } = form;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      placement="center"
      size={isSplit ? 'md' : 'sm'}
      isDismissable={!isSubmitting}
      hideCloseButton={isSubmitting}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <span className="text-base font-semibold">Encaisser</span>
          <span className="text-sm font-normal text-muted-foreground">
            Commande {orderRef} ·{' '}
            <span className="font-medium tabular-nums">
              {priceFormatter.format(amount)} F
            </span>
          </span>
        </ModalHeader>
        <ModalBody>
          {showSingleGrid && (
            <SingleModeGrid form={form} isSubmitting={isSubmitting} />
          )}

          {showCashTender && (
            <CashTenderPanel
              form={form}
              amount={amount}
              isSubmitting={isSubmitting}
            />
          )}

          {isSplit && <SplitLines form={form} isSubmitting={isSubmitting} />}

          <button
            type="button"
            onClick={startSplit}
            disabled={isSubmitting}
            className="mt-2 flex items-center gap-1 self-start text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
          >
            <Plus className="h-3.5 w-3.5" />
            Ajouter un moyen de paiement
          </button>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </ModalBody>
        <ModalFooter>
          <Button
            color="default"
            variant="light"
            onPress={handleClose}
            isDisabled={isSubmitting}
          >
            Annuler
          </Button>
          <Button
            color="primary"
            onPress={handleConfirm}
            isDisabled={!canConfirm || isSubmitting}
            isLoading={isSubmitting}
          >
            Marquer payée
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
