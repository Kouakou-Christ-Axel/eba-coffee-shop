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
import { ChevronDown, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCartStore, type CartItemSupplement } from '@/lib/cart-store';
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
  /** Pré-remplit depuis une ligne existante (mode « dupliquer avec des
   * suppléments différents » depuis le panier), plutôt que partir de zéro. */
  initialSupplements?: CartItemSupplement[];
  /** Jeton qui force la réinitialisation des sélections quand il change (ex.
   * cartId de la ligne dupliquée). Laisser indéfini en ajout normal. */
  editToken?: string;
};

function SupplementModal({
  product,
  isOpen,
  onClose,
  initialSupplements,
  editToken,
}: SupplementModalProps) {
  const { addItem } = useCartStore();
  const groups = product.supplements ?? [];
  // Groupes propres au produit vs extras globaux (« Extras », configurés une
  // fois pour tous les produits, ajoutés en fin de liste par lib/menu.ts) : les
  // seconds restent masqués derrière un bouton, sans quoi la liste devient trop
  // longue pour finir une commande (ex. un produit à plusieurs goûts + de
  // nombreux extras disponibles).
  const productGroups = groups.filter((g) => !g.isGlobal);
  const globalGroups = groups.filter((g) => g.isGlobal);

  const resetKey = `${product.id}::${editToken ?? ''}`;

  const [selections, setSelections] = useResettableState<Selections>(
    resetKey,
    () => buildInitialSelections(product, initialSupplements ?? [])
  );

  // Groupes repliés par défaut (sauf ceux requis, qu'il faut bien remplir) pour
  // limiter la hauteur initiale du sélecteur ; chaque groupe se déplie
  // individuellement au clic sur son en-tête.
  const [openGroups, setOpenGroups] = useResettableState<
    Record<string, boolean>
  >(resetKey, () =>
    Object.fromEntries(productGroups.map((g) => [g.name, g.required]))
  );
  const [showExtras, setShowExtras] = useResettableState<boolean>(
    resetKey,
    () => false
  );

  function toggleGroup(groupName: string) {
    setOpenGroups((prev) => ({ ...prev, [groupName]: !prev[groupName] }));
  }

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
    addItem(
      {
        productId: product.id,
        productName: product.name,
        basePrice: product.price,
        coutMatiere: product.coutMatiere ?? 0,
        coutEmballage: product.coutEmballage ?? 0,
        // Le site public n'enregistre pas les choix uniques gratuits (ex.
        // « Lait classique »), contrairement à la caisse qui les garde visibles
        // pour la cuisine.
        supplements: getSelectedSupplements(product, selections, false),
      },
      product.remaining ?? undefined
    );
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

        <ModalBody className="gap-3">
          {productGroups.map((group) => renderGroup(group))}

          {globalGroups.length > 0 &&
            (showExtras ? (
              <div className="space-y-3 border-t pt-3">
                <p className="text-xs font-semibold tracking-wide text-foreground/40 uppercase">
                  Extras
                </p>
                {globalGroups.map((group) => renderGroup(group))}
              </div>
            ) : (
              <Button
                variant="flat"
                size="sm"
                className="w-full"
                onPress={() => setShowExtras(() => true)}
              >
                + Ajouter un extra
              </Button>
            ))}
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

  function renderGroup(group: (typeof groups)[number]) {
    const constraint = groupConstraintLabel(group);
    const count = groupSelectionCount(group, selections);
    const max = effectiveMax(group);
    const isOpen = openGroups[group.name] ?? false;

    return (
      <div key={group.name} className="rounded-lg border border-foreground/10">
        <button
          type="button"
          onClick={() => toggleGroup(group.name)}
          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
        >
          <span className="text-sm font-semibold text-foreground/80">
            {group.name}
            {group.required && (
              <span className="ml-1 text-xs text-primary">(requis)</span>
            )}
          </span>
          <span className="flex shrink-0 items-center gap-1.5 text-xs text-foreground/50">
            {count > 0 && (
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
                {count}
              </span>
            )}
            <ChevronDown
              className={cn(
                'size-4 transition-transform',
                isOpen && 'rotate-180'
              )}
            />
          </span>
        </button>

        {isOpen && (
          <div className="space-y-2 px-3 pb-3">
            {constraint && (
              <p className="text-xs font-normal text-foreground/50">
                {constraint}
              </p>
            )}

            {group.type === 'single' && (
              <RadioGroup
                value={selections[group.name] as string}
                onValueChange={(v) => setSingle(group.name, v)}
              >
                {group.options.map((opt) => (
                  <Radio
                    key={opt.name}
                    value={opt.name}
                    isDisabled={opt.soldOut}
                  >
                    <span className="flex items-center justify-between gap-4">
                      <span className="text-sm">
                        {opt.name}
                        {opt.soldOut && (
                          <span className="ml-1.5 text-xs font-medium text-danger">
                            épuisé
                          </span>
                        )}
                      </span>
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
                  const current = (selections[group.name] as string[]) ?? [];
                  const isChecked = current.includes(opt.name);
                  const isDisabled =
                    opt.soldOut || (!isChecked && count >= max);
                  return (
                    <Checkbox
                      key={opt.name}
                      isSelected={isChecked}
                      isDisabled={isDisabled}
                      onValueChange={() => toggleMultiple(group.name, opt.name)}
                    >
                      <span className="flex items-center justify-between gap-4">
                        <span className="text-sm">
                          {opt.name}
                          {opt.soldOut && (
                            <span className="ml-1.5 text-xs font-medium text-danger">
                              épuisé
                            </span>
                          )}
                        </span>
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
                  // Plafond de l'option : borne du groupe (répartition
                  // totale) ET stock restant de l'option elle-même — la
                  // plus stricte des deux gagne.
                  const optionCap = opt.remaining ?? Infinity;
                  const canIncrement =
                    !opt.soldOut && count < max && qty < optionCap;
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
                        {opt.soldOut && (
                          <span className="ml-1.5 text-xs font-medium text-danger">
                            épuisé
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
                          onPress={() => setQuantity(group.name, opt.name, -1)}
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
                          onPress={() => setQuantity(group.name, opt.name, 1)}
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
          </div>
        )}
      </div>
    );
  }
}

export default SupplementModal;
