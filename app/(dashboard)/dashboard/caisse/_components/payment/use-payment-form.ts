'use client';

import { useState } from 'react';
import { computeChange } from '@/lib/cash-tender';
import type { PaymentMode } from '@/generated/prisma/client';
import type { Line, PaymentLine } from './types';

export type PaymentFormState = ReturnType<typeof usePaymentForm>;

export function usePaymentForm({
  amount,
  isSubmitting,
  onClose,
  onConfirm,
}: {
  amount: number;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (payments: PaymentLine[]) => void;
}) {
  const [lines, setLines] = useState<Line[]>([]);
  const [isSplit, setIsSplit] = useState(false);
  // Montant remis par le client, pour calculer le rendu. Purement local : ce
  // n'est PAS envoyé au serveur (le paiement enregistré reste le montant dû).
  const [tendered, setTendered] = useState<number | null>(null);

  const total = lines.reduce((s, l) => s + (l.amount || 0), 0);
  const remaining = amount - total;
  const canConfirm =
    lines.length > 0 &&
    lines.every((l) => l.mode !== null && l.amount > 0) &&
    remaining === 0;

  function resetState() {
    setLines([]);
    setIsSplit(false);
    setTendered(null);
  }

  function handleClose() {
    if (isSubmitting) return;
    resetState();
    onClose();
  }

  function handleConfirm() {
    if (!canConfirm) return;
    onConfirm(lines as PaymentLine[]);
  }

  // Chemin rapide (pas encore en mode fractionné) : un tap remplace la ligne
  // unique, couvrant tout le montant.
  function selectSingleMode(mode: PaymentMode) {
    setLines([{ mode, amount }]);
    // Changer de moyen de paiement invalide un « reçu » saisi pour les espèces.
    if (mode !== 'CASH') setTendered(null);
  }

  function startSplit() {
    setIsSplit(true);
    setTendered(null);
    setLines((prev) => {
      if (prev.length === 0)
        return [
          { mode: null, amount },
          { mode: null, amount: 0 },
        ];
      return [...prev, { mode: null, amount: 0 }];
    });
  }

  function updateLineMode(index: number, mode: PaymentMode) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, mode } : l)));
  }

  function updateLineAmount(index: number, value: string) {
    const parsed = Math.max(0, Math.floor(Number(value) || 0));
    setLines((prev) =>
      prev.map((l, i) => (i === index ? { ...l, amount: parsed } : l))
    );
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  const showSingleGrid = !isSplit;
  const singleSelected = lines[0]?.mode ?? null;
  // Le rendu de monnaie n'a de sens qu'en espèces, hors paiement fractionné.
  const showCashTender = !isSplit && singleSelected === 'CASH';
  const change = tendered === null ? null : computeChange(amount, tendered);

  return {
    lines,
    isSplit,
    tendered,
    setTendered,
    remaining,
    canConfirm,
    showSingleGrid,
    singleSelected,
    showCashTender,
    change,
    handleClose,
    handleConfirm,
    selectSingleMode,
    startSplit,
    updateLineMode,
    updateLineAmount,
    removeLine,
  };
}
