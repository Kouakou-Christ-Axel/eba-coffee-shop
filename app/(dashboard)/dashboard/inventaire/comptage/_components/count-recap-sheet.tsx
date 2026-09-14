'use client';

// Le récapitulatif avant d'écrire au registre.
//
// Il existe pour une seule phrase : « les N références non comptées ne sont pas
// modifiées ». C'est déjà le comportement du serveur — les lignes vides sont
// ignorées — mais il était totalement invisible. Sur 117 références, compter en
// plusieurs fois est la norme : le partiel doit être un choix énoncé, pas un
// effet de bord découvert trois semaines plus tard sur une consommation fausse.
//
// Les écarts sont relus ici, du plus gros au plus petit : c'est le dernier
// moment où une erreur de saisie coûte encore zéro, `InventoryCountLine` étant
// figée à l'écriture.

import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@heroui/react';
import { AlertCircle, TriangleAlert } from 'lucide-react';

import {
  BOTTOM_SHEET_PLACEMENT,
  bottomSheetClassNames,
} from '@/lib/bottom-sheet';
import type { InventoryItemView } from '@/lib/inventory';
import {
  computeDiffs,
  countEntered,
  type CountDraft,
} from '@/lib/inventory-count-draft';
import { useInventoryCountStore } from '@/lib/hooks/use-inventory-count';
import { cn } from '@/lib/utils';

const f = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });

export function CountRecapSheet({
  open,
  onClose,
  draft,
  items,
  isPending,
  error,
  onConfirm,
  onSeeRemaining,
}: {
  open: boolean;
  onClose: () => void;
  draft: CountDraft;
  items: InventoryItemView[];
  isPending: boolean;
  error: string | null;
  onConfirm: () => void;
  onSeeRemaining: () => void;
}) {
  const setLabel = useInventoryCountStore((s) => s.setLabel);

  const entered = countEntered(draft.counts);
  const missing = items.length - entered;
  const byId = new Map(items.map((it) => [it.id, it]));
  const diffs = computeDiffs(draft.counts, items);
  const surplusCount = diffs.filter((d) => d.surplus).length;

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      placement={BOTTOM_SHEET_PLACEMENT}
      scrollBehavior="inside"
      size="lg"
      classNames={bottomSheetClassNames()}
    >
      <ModalContent>
        <ModalHeader className="flex-col items-start gap-1">
          <span>Valider l&apos;inventaire</span>
          <span className="text-sm font-normal text-muted-foreground tabular-nums">
            {entered} comptée{entered > 1 ? 's' : ''} · {missing} non comptée
            {missing > 1 ? 's' : ''}
          </span>
        </ModalHeader>

        <ModalBody className="gap-4">
          {missing > 0 && (
            <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              Les <strong>{missing} références non comptées</strong> ne sont pas
              modifiées : leur stock système reste tel quel, et leur
              consommation ne sera pas calculée pour cette période.{' '}
              <button
                type="button"
                onClick={onSeeRemaining}
                className="font-medium text-primary underline underline-offset-2"
              >
                Voir les non comptées
              </button>
            </p>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="count-label"
              className="text-sm font-medium text-muted-foreground"
            >
              Libellé (optionnel)
            </label>
            <Input
              id="count-label"
              value={draft.label}
              onValueChange={setLabel}
              placeholder="Ex. Inventaire septembre"
              size="lg"
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">
              {diffs.length === 0
                ? 'Aucun écart'
                : `${diffs.length} écart${diffs.length > 1 ? 's' : ''}`}
              {surplusCount > 0 && (
                <span className="ml-1 font-normal text-amber-700 dark:text-amber-400">
                  · {surplusCount} en surplus
                </span>
              )}
            </p>

            {diffs.length > 0 && (
              <ul className="divide-y rounded-md border">
                {diffs.map((diff) => {
                  const item = byId.get(diff.itemId);
                  if (!item) return null;
                  return (
                    <li
                      key={diff.itemId}
                      className="flex items-center gap-3 px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {item.name}
                        {diff.surplus && (
                          <TriangleAlert
                            className="ml-1 inline size-3.5 text-amber-600"
                            aria-label="Plus que le stock théorique"
                          />
                        )}
                      </span>
                      <span className="shrink-0 text-muted-foreground tabular-nums">
                        {f.format(diff.system)} → {f.format(diff.counted)}
                      </span>
                      <span
                        className={cn(
                          'w-14 shrink-0 text-right font-semibold tabular-nums',
                          diff.delta > 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-destructive'
                        )}
                      >
                        {diff.delta > 0 ? '+' : ''}
                        {f.format(diff.delta)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}

            {surplusCount > 0 && (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                Un surplus signifie qu&apos;il y a plus en rayon que le stock
                théorique : un achat n&apos;a probablement pas été enregistré.
              </p>
            )}
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </ModalBody>

        <ModalFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button variant="light" onPress={onClose} className="h-11 sm:w-auto">
            Continuer le comptage
          </Button>
          <Button
            color="primary"
            onPress={onConfirm}
            isLoading={isPending}
            className="h-11 sm:w-auto"
          >
            Enregistrer {entered} référence{entered > 1 ? 's' : ''}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
