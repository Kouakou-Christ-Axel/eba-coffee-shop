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
import { priceFormatter, type Product } from '@/config/menu';
import type { CartItemSupplement } from '@/lib/cart-store';

type Props = {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onAdd: (input: {
    product: Product;
    supplements: CartItemSupplement[];
  }) => void;
  /** Sélections de départ (mode édition d'une ligne existante). */
  initialSupplements?: CartItemSupplement[];
  /**
   * Jeton qui force la réinitialisation des sélections quand il change
   * (ex. cartId de la ligne éditée). En mode ajout, laisser indéfini.
   */
  editToken?: string;
  /** Libellé du verbe d'action (« Ajouter » par défaut, « Mettre à jour » en édition). */
  confirmVerb?: string;
};

function buildSelections(
  p: Product | null,
  initial: CartItemSupplement[]
): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  (p?.supplements ?? []).forEach((g) => {
    if (g.type === 'single') {
      const found = initial.find((s) => s.groupName === g.name);
      out[g.name] = found ? found.optionName : '';
    } else {
      out[g.name] = initial
        .filter((s) => s.groupName === g.name)
        .map((s) => s.optionName);
    }
  });
  return out;
}

export function SupplementPicker({
  product,
  isOpen,
  onClose,
  onAdd,
  initialSupplements,
  editToken,
  confirmVerb = 'Ajouter',
}: Props) {
  const groups = product?.supplements ?? [];

  // Pattern React "store previous prop" — reset des sélections quand le produit
  // OU la ligne éditée change, sans useEffect (cf.
  // https://react.dev/learn/you-might-not-need-an-effect).
  const currentKey = `${product?.id ?? ''}::${editToken ?? ''}`;
  const [prevKey, setPrevKey] = useState<string>(currentKey);
  const [selections, setSelections] = useState<
    Record<string, string | string[]>
  >(() => buildSelections(product, initialSupplements ?? []));

  if (product && currentKey !== prevKey) {
    setPrevKey(currentKey);
    setSelections(buildSelections(product, initialSupplements ?? []));
  }

  if (!product) return null;

  function getSelectedSupplements(): CartItemSupplement[] {
    const result: CartItemSupplement[] = [];
    groups.forEach((group) => {
      const sel = selections[group.name];
      if (group.type === 'single' && typeof sel === 'string' && sel) {
        const opt = group.options.find((o) => o.name === sel);
        // On enregistre le choix même gratuit (ex. sauce) pour qu'il reste
        // visible en cuisine et modifiable ensuite.
        if (opt) {
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
    return (
      product!.price +
      getSelectedSupplements().reduce((sum, s) => sum + s.price, 0)
    );
  }

  function canSubmit(): boolean {
    return groups.every((g) => {
      if (!g.required) return true;
      const sel = selections[g.name];
      if (g.type === 'single') return typeof sel === 'string' && sel !== '';
      return Array.isArray(sel) && sel.length > 0;
    });
  }

  function handleAdd() {
    if (!canSubmit()) return;
    onAdd({ product: product!, supplements: getSelectedSupplements() });
    onClose();
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
          {groups.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Aucun supplément. Tape « Ajouter » pour mettre au panier.
            </p>
          )}
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
                  value={(selections[group.name] as string) ?? ''}
                  onValueChange={(v) =>
                    setSelections((prev) => ({ ...prev, [group.name]: v }))
                  }
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
                  {group.options.map((opt) => {
                    const current = (selections[group.name] as string[]) ?? [];
                    return (
                      <Checkbox
                        key={opt.name}
                        isSelected={current.includes(opt.name)}
                        onValueChange={() =>
                          setSelections((prev) => {
                            const cur = (prev[group.name] as string[]) ?? [];
                            const next = cur.includes(opt.name)
                              ? cur.filter((n) => n !== opt.name)
                              : [...cur, opt.name];
                            return { ...prev, [group.name]: next };
                          })
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
            </fieldset>
          ))}
        </ModalBody>

        <ModalFooter>
          <Button
            color="primary"
            className="w-full"
            size="lg"
            onPress={handleAdd}
            isDisabled={!canSubmit()}
          >
            {confirmVerb} — {priceFormatter.format(getRunningTotal())} F
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
