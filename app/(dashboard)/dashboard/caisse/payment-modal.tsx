'use client';

import { useState } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from '@heroui/react';
import { Banknote, MoreHorizontal, Smartphone, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PaymentMode } from '@/generated/prisma/client';

const priceFormatter = new Intl.NumberFormat('fr-FR');

const MODES: {
  value: PaymentMode;
  label: string;
  Icon: typeof Banknote;
}[] = [
  { value: 'CASH', label: 'Espèces', Icon: Banknote },
  { value: 'WAVE', label: 'Wave', Icon: Smartphone },
  { value: 'ORANGE_MONEY', label: 'Orange Money', Icon: Wallet },
  { value: 'OTHER', label: 'Autre', Icon: MoreHorizontal },
];

type Props = {
  isOpen: boolean;
  onClose: () => void;
  orderRef: string;
  amount: number;
  isSubmitting: boolean;
  onConfirm: (mode: PaymentMode) => void;
  error?: string | null;
};

export function PaymentModal({
  isOpen,
  onClose,
  orderRef,
  amount,
  isSubmitting,
  onConfirm,
  error,
}: Props) {
  const [selected, setSelected] = useState<PaymentMode | null>(null);

  function handleClose() {
    if (isSubmitting) return;
    setSelected(null);
    onClose();
  }

  function handleConfirm() {
    if (!selected) return;
    onConfirm(selected);
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      placement="center"
      size="sm"
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
          <div className="grid grid-cols-2 gap-2">
            {MODES.map(({ value, label, Icon }) => {
              const isActive = selected === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSelected(value)}
                  disabled={isSubmitting}
                  className={cn(
                    'flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 px-2 py-4 text-sm font-medium transition-colors',
                    isActive
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card hover:bg-muted',
                    isSubmitting && 'opacity-50'
                  )}
                >
                  <Icon className="h-6 w-6" strokeWidth={1.75} />
                  {label}
                </button>
              );
            })}
          </div>
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
            isDisabled={!selected || isSubmitting}
            isLoading={isSubmitting}
          >
            Marquer payée
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
