'use client';

import { useState } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
} from '@heroui/react';
import {
  Banknote,
  MoreHorizontal,
  Plus,
  Smartphone,
  Wallet,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { computeChange, suggestCashTenders } from '@/lib/cash-tender';
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

export type PaymentLine = { mode: PaymentMode; amount: number };

type Line = { mode: PaymentMode | null; amount: number };

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
            <div className="grid grid-cols-2 gap-2">
              {MODES.map(({ value, label, Icon }) => {
                const isActive = singleSelected === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => selectSingleMode(value)}
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
          )}

          {showCashTender && (
            <div className="flex flex-col gap-2 rounded-xl border-2 border-border bg-muted/40 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Reçu du client (facultatif)
              </p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setTendered(amount)}
                  disabled={isSubmitting}
                  className={cn(
                    'h-11 rounded-lg border-2 px-3 text-sm font-medium tabular-nums transition-colors',
                    tendered === amount
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card hover:bg-muted'
                  )}
                >
                  Appoint
                </button>
                {suggestCashTenders(amount).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTendered(value)}
                    disabled={isSubmitting}
                    className={cn(
                      'h-11 rounded-lg border-2 px-3 text-sm font-medium tabular-nums transition-colors',
                      tendered === value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-card hover:bg-muted'
                    )}
                  >
                    {priceFormatter.format(value)}
                  </button>
                ))}
              </div>
              <Input
                type="number"
                inputMode="numeric"
                size="sm"
                aria-label="Montant reçu du client"
                placeholder="Autre montant"
                value={tendered === null ? '' : String(tendered)}
                onValueChange={(v) =>
                  setTendered(
                    v.trim() === ''
                      ? null
                      : Math.max(0, Math.floor(Number(v) || 0))
                  )
                }
                endContent={<span className="text-xs">F</span>}
                isDisabled={isSubmitting}
              />
              {change !== null && (
                <div className="flex items-baseline justify-between rounded-lg bg-green-50 px-3 py-2 dark:bg-green-950/40">
                  <span className="text-sm font-medium text-green-900 dark:text-green-100">
                    Rendre
                  </span>
                  <span className="text-2xl font-bold tabular-nums text-green-700 dark:text-green-300">
                    {priceFormatter.format(change)} F
                  </span>
                </div>
              )}
              {tendered !== null && change === null && (
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                  Il manque {priceFormatter.format(amount - tendered)} F
                </p>
              )}
            </div>
          )}

          {isSplit && (
            <div className="flex flex-col gap-3">
              {lines.map((line, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 rounded-xl border-2 border-border bg-card p-2"
                >
                  <div className="grid flex-1 grid-cols-4 gap-1">
                    {MODES.map(({ value, label, Icon }) => {
                      const isActive = line.mode === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          title={label}
                          onClick={() => updateLineMode(index, value)}
                          disabled={isSubmitting}
                          className={cn(
                            'flex flex-col items-center justify-center gap-0.5 rounded-lg border-2 py-1.5 text-[10px] font-medium transition-colors',
                            isActive
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border bg-card hover:bg-muted'
                          )}
                        >
                          <Icon className="h-4 w-4" strokeWidth={1.75} />
                        </button>
                      );
                    })}
                  </div>
                  <Input
                    type="number"
                    inputMode="numeric"
                    size="sm"
                    className="w-28"
                    aria-label="Montant de cette ligne"
                    value={String(line.amount)}
                    onValueChange={(v) => updateLineAmount(index, v)}
                    endContent={<span className="text-xs">F</span>}
                    isDisabled={isSubmitting}
                  />
                  <button
                    type="button"
                    aria-label="Retirer cette ligne"
                    onClick={() => removeLine(index)}
                    disabled={isSubmitting}
                    className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}

              <p
                className={cn(
                  'text-right text-sm font-medium tabular-nums',
                  remaining === 0 ? 'text-green-700' : 'text-amber-700'
                )}
              >
                Restant : {priceFormatter.format(remaining)} F
              </p>
            </div>
          )}

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
