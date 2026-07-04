// components/(public)/carte/supplement-modal.tsx
'use client';

import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  RadioGroup,
  Radio,
  Checkbox,
} from '@heroui/react';
import { Minus, Plus } from 'lucide-react';
import { useCartStore } from '@/lib/cart-store';
import { priceFormatter, type Product } from '@/config/menu';
import {
  buildInitialSelections,
  canSubmitSelections,
  effectiveMax,
  getSelectedSupplements,
  getSupplementsPrice,
  groupConstraintLabel,
  groupSelectionCount,
  optionQuantity,
  type Selections,
} from '@/lib/supplements';
import { useResettableState } from '@/lib/hooks/use-resettable-state';

type SupplementModalProps = {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
};

function SupplementModal({ product, isOpen, onClose }: SupplementModalProps) {
  const { addItem } = useCartStore();
  const groups = product.supplements ?? [];

  const [selections, setSelections] = useResettableState<Selections>(
    product.id,
    () => buildInitialSelections(product, [])
  );

  function setSingle(groupName: string, value: string) {
    setSelections((prev) => ({ ...prev, [groupName]: value }));
  }

  function toggleMultiple(groupName: string, optionName: string) {
    setSelections((prev) => {
      const cur = (prev[groupName] as string[]) ?? [];
      const next = cur.includes(optionName)
        ? cur.filter((n) => n !== optionName)
        : [...cur, optionName];
      return { ...prev, [groupName]: next };
    });
  }

  function setQuantity(groupName: string, optionName: string, delta: number) {
    setSelections((prev) => {
      const cur = (prev[groupName] as Record<string, number>) ?? {};
      const next = Math.max(0, (cur[optionName] ?? 0) + delta);
      return { ...prev, [groupName]: { ...cur, [optionName]: next } };
    });
  }

  function handleAdd() {
    if (!canSubmitSelections(product, selections)) return;
    addItem({
      productId: product.id,
      productName: product.name,
      basePrice: product.price,
      coutMatiere: product.coutMatiere ?? 0,
      coutEmballage: product.coutEmballage ?? 0,
      // Le site public n'enregistre pas les choix uniques gratuits (ex.
      // « Lait classique »), contrairement à la caisse qui les garde visibles
      // pour la cuisine.
      supplements: getSelectedSupplements(product, selections, false),
    });
    setSelections(() => buildInitialSelections(product, []));
    onClose();
  }

  const runningTotal =
    product.price +
    getSupplementsPrice(getSelectedSupplements(product, selections, false));

  return (
    <Modal isOpen={isOpen} onClose={onClose} placement="center" size="md">
      <ModalContent>
        <ModalHeader className="flex-col items-start gap-1">
          <span className="text-lg font-semibold">{product.name}</span>
          <span className="text-sm font-normal text-foreground/50">
            À partir de {priceFormatter.format(product.price)} F
          </span>
        </ModalHeader>

        <ModalBody className="gap-6">
          {groups.map((group) => {
            const constraint = groupConstraintLabel(group);
            const count = groupSelectionCount(group, selections);
            const max = effectiveMax(group);
            return (
              <fieldset key={group.name}>
                <legend className="mb-2 text-sm font-semibold text-foreground/80">
                  {group.name}
                  {group.required && (
                    <span className="ml-1 text-xs text-primary">(requis)</span>
                  )}
                  {constraint && (
                    <span className="ml-2 text-xs font-normal text-foreground/50">
                      {constraint}
                    </span>
                  )}
                </legend>

                {group.type === 'single' && (
                  <RadioGroup
                    value={selections[group.name] as string}
                    onValueChange={(v) => setSingle(group.name, v)}
                  >
                    {group.options.map((opt) => (
                      <Radio key={opt.name} value={opt.name}>
                        <span className="flex items-center justify-between gap-4">
                          <span className="text-sm">{opt.name}</span>
                          <span className="text-xs text-foreground/50">
                            {opt.price === 0
                              ? 'Inclus'
                              : `+${priceFormatter.format(opt.price)} F`}
                          </span>
                        </span>
                      </Radio>
                    ))}
                  </RadioGroup>
                )}

                {group.type === 'multiple' && (
                  <div className="space-y-2">
                    {group.options.map((opt) => {
                      const current =
                        (selections[group.name] as string[]) ?? [];
                      const isChecked = current.includes(opt.name);
                      const isDisabled = !isChecked && count >= max;
                      return (
                        <Checkbox
                          key={opt.name}
                          isSelected={isChecked}
                          isDisabled={isDisabled}
                          onValueChange={() =>
                            toggleMultiple(group.name, opt.name)
                          }
                        >
                          <span className="flex items-center justify-between gap-4">
                            <span className="text-sm">{opt.name}</span>
                            <span className="text-xs text-foreground/50">
                              +{priceFormatter.format(opt.price)} F
                            </span>
                          </span>
                        </Checkbox>
                      );
                    })}
                  </div>
                )}

                {group.type === 'quantity' && (
                  <div className="space-y-2">
                    {group.options.map((opt) => {
                      const qty = optionQuantity(group, selections, opt.name);
                      const canIncrement = count < max;
                      return (
                        <div
                          key={opt.name}
                          className="flex items-center justify-between gap-4"
                        >
                          <span className="text-sm">
                            {opt.name}
                            {opt.price > 0 && (
                              <span className="ml-1 text-xs text-foreground/50">
                                +{priceFormatter.format(opt.price)} F
                              </span>
                            )}
                          </span>
                          <div className="flex items-center gap-2">
                            <Button
                              isIconOnly
                              size="sm"
                              variant="flat"
                              isDisabled={qty === 0}
                              aria-label={`Retirer ${opt.name}`}
                              onPress={() =>
                                setQuantity(group.name, opt.name, -1)
                              }
                            >
                              <Minus className="size-3.5" />
                            </Button>
                            <span className="w-5 text-center text-sm font-medium">
                              {qty}
                            </span>
                            <Button
                              isIconOnly
                              size="sm"
                              variant="flat"
                              isDisabled={!canIncrement}
                              aria-label={`Ajouter ${opt.name}`}
                              onPress={() =>
                                setQuantity(group.name, opt.name, 1)
                              }
                            >
                              <Plus className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                    {Number.isFinite(max) && (
                      <p className="text-right text-xs text-foreground/50">
                        {count} / {max} sélectionné(s)
                      </p>
                    )}
                  </div>
                )}
              </fieldset>
            );
          })}
        </ModalBody>

        <ModalFooter>
          <Button
            color="primary"
            className="w-full"
            size="lg"
            onPress={handleAdd}
            isDisabled={!canSubmitSelections(product, selections)}
          >
            Ajouter — {priceFormatter.format(runningTotal)} F
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export default SupplementModal;
