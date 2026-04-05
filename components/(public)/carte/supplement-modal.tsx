// components/(public)/carte/supplement-modal.tsx
'use client';

import { useState } from 'react';
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
import { useCartStore, type CartItemSupplement } from '@/lib/cart-store';
import { priceFormatter, type Product } from '@/config/menu';

type SupplementModalProps = {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
};

function SupplementModal({ product, isOpen, onClose }: SupplementModalProps) {
  const { addItem } = useCartStore();
  const groups = product.supplements ?? [];

  // State: one entry per group. For 'single' = string (option name), for 'multiple' = string[] (option names)
  const [selections, setSelections] = useState<
    Record<string, string | string[]>
  >(() => {
    const initial: Record<string, string | string[]> = {};
    groups.forEach((g) => {
      initial[g.name] = g.type === 'single' ? '' : [];
    });
    return initial;
  });

  function getSelectedSupplements(): CartItemSupplement[] {
    const result: CartItemSupplement[] = [];
    groups.forEach((group) => {
      const sel = selections[group.name];
      if (group.type === 'single' && typeof sel === 'string' && sel) {
        const opt = group.options.find((o) => o.name === sel);
        if (opt && opt.price > 0) {
          result.push({
            groupName: group.name,
            optionName: opt.name,
            price: opt.price,
          });
        }
      } else if (group.type === 'multiple' && Array.isArray(sel)) {
        sel.forEach((name) => {
          const opt = group.options.find((o) => o.name === name);
          if (opt) {
            result.push({
              groupName: group.name,
              optionName: opt.name,
              price: opt.price,
            });
          }
        });
      }
    });
    return result;
  }

  function getRunningTotal(): number {
    const supps = getSelectedSupplements();
    return product.price + supps.reduce((sum, s) => sum + s.price, 0);
  }

  function handleAdd() {
    addItem({
      productId: product.id,
      productName: product.name,
      basePrice: product.price,
      supplements: getSelectedSupplements(),
    });
    // Reset selections
    const reset: Record<string, string | string[]> = {};
    groups.forEach((g) => {
      reset[g.name] = g.type === 'single' ? '' : [];
    });
    setSelections(reset);
    onClose();
  }

  function handleSingleChange(groupName: string, value: string) {
    setSelections((prev) => ({ ...prev, [groupName]: value }));
  }

  function handleMultipleToggle(groupName: string, optionName: string) {
    setSelections((prev) => {
      const current = prev[groupName] as string[];
      const next = current.includes(optionName)
        ? current.filter((n) => n !== optionName)
        : [...current, optionName];
      return { ...prev, [groupName]: next };
    });
  }

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
          {groups.map((group) => (
            <fieldset key={group.name}>
              <legend className="mb-2 text-sm font-semibold text-foreground/80">
                {group.name}
                {group.required && (
                  <span className="ml-1 text-xs text-primary">(requis)</span>
                )}
              </legend>

              {group.type === 'single' ? (
                <RadioGroup
                  value={selections[group.name] as string}
                  onValueChange={(v) => handleSingleChange(group.name, v)}
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
              ) : (
                <div className="space-y-2">
                  {group.options.map((opt) => (
                    <Checkbox
                      key={opt.name}
                      isSelected={(selections[group.name] as string[]).includes(
                        opt.name
                      )}
                      onValueChange={() =>
                        handleMultipleToggle(group.name, opt.name)
                      }
                    >
                      <span className="flex items-center justify-between gap-4">
                        <span className="text-sm">{opt.name}</span>
                        <span className="text-xs text-foreground/50">
                          +{priceFormatter.format(opt.price)} F
                        </span>
                      </span>
                    </Checkbox>
                  ))}
                </div>
              )}
            </fieldset>
          ))}
        </ModalBody>

        <ModalFooter>
          <Button
            color="primary"
            className="w-full"
            size="lg"
            onPress={handleAdd}
          >
            Ajouter — {priceFormatter.format(getRunningTotal())} F
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export default SupplementModal;
