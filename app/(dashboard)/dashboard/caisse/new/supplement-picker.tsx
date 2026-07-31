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
import { priceFormatter, type Product } from '@/config/menu';
import type { CartItemSupplement } from '@/lib/cart-store';
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
import { applyOptionStock } from '@/lib/caisse-restock';
import { RestockControl } from '../_components/restock-control';

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
  /**
   * Réappro caisse déclenchée depuis le sélecteur (cas tartelettes : recréditer
   * le stock d'un goût épuisé). Quand fourni, un bouton « Réappro » apparaît sur
   * les goûts à stock suivi des groupes de type `quantity`. Le parent en profite
   * pour synchroniser son menu (stock live).
   */
  onRestocked?: (
    groupName: string,
    optionName: string,
    stockQuantity: number | null
  ) => void;
};

export function SupplementPicker({
  product,
  isOpen,
  onClose,
  onAdd,
  initialSupplements,
  editToken,
  confirmVerb = 'Ajouter',
  onRestocked,
}: Props) {
  const resetKey = `${product?.id ?? ''}::${editToken ?? ''}`;

  const [selections, setSelections] = useResettableState<Selections>(
    resetKey,
    () => buildInitialSelections(product, initialSupplements ?? [])
  );
  // Copie « live » du produit : la réappro d'un goût met à jour le stock ici
  // pour que le stepper le rende immédiatement commandable, sans rechargement.
  const [liveProduct, setLiveProduct] = useResettableState<Product | null>(
    product?.id ?? '',
    () => product
  );
  // Groupes repliés par défaut (sauf ceux requis) et extras globaux masqués
  // derrière un bouton : sans ça, la liste (goûts du produit + tous les
  // extras disponibles) devient trop longue pour finir une commande.
  const [openGroups, setOpenGroups] = useResettableState<
    Record<string, boolean>
  >(resetKey, () =>
    Object.fromEntries(
      (product?.supplements ?? [])
        .filter((g) => !g.isGlobal)
        .map((g) => [g.name, g.required])
    )
  );
  const [showExtras, setShowExtras] = useResettableState<boolean>(
    resetKey,
    () => false
  );

  function toggleGroup(groupName: string) {
    setOpenGroups((prev) => ({ ...prev, [groupName]: !prev[groupName] }));
  }

  if (!product) return null;
  const activeProduct = liveProduct ?? product;
  const groups = activeProduct.supplements ?? [];
  const productGroups = groups.filter((g) => !g.isGlobal);
  const globalGroups = groups.filter((g) => g.isGlobal);

  function handleOptionRestocked(
    groupName: string,
    optionName: string,
    stockQuantity: number | null
  ) {
    setLiveProduct((prev) =>
      prev ? applyOptionStock(prev, groupName, optionName, stockQuantity) : prev
    );
    onRestocked?.(groupName, optionName, stockQuantity);
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
    if (!canSubmitSelections(activeProduct, selections)) return;
    onAdd({
      product: activeProduct,
      supplements: getSelectedSupplements(activeProduct, selections),
    });
    onClose();
  }

  const runningTotal =
    activeProduct.price +
    getSupplementsPrice(getSelectedSupplements(activeProduct, selections));

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
          {groups.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Aucun supplément. Tape « Ajouter » pour mettre au panier.
            </p>
          )}

          {productGroups.map((group) => renderGroup(group))}

          {globalGroups.length > 0 &&
            (showExtras ? (
              <div className="space-y-3 border-t pt-3">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
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
            isDisabled={!canSubmitSelections(activeProduct, selections)}
          >
            {confirmVerb} — {priceFormatter.format(runningTotal)} F
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
          <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
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
                value={(selections[group.name] as string) ?? ''}
                onValueChange={(v) => setSingle(group.name, v)}
              >
                {/* Option de désélection pour les groupes facultatifs :
                        permet de revenir à « aucun choix ». */}
                {!group.required && (
                  <Radio value="">
                    <span className="text-sm text-foreground/60">Aucun</span>
                  </Radio>
                )}
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
                  // plus stricte des deux gagne. Sans ce plafond, le
                  // compteur (qui exclut les options épuisées, cf.
                  // `groupSelectionCount`) peut afficher « N / N » alors
                  // qu'une option épuisée reste incrémentable en plus —
                  // désynchronisant l'affichage de la sélection réelle.
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
                        {opt.soldOut ? (
                          <span className="ml-1.5 text-xs font-medium text-danger">
                            épuisé
                          </span>
                        ) : (
                          opt.remaining != null && (
                            <span className="ml-1.5 text-xs text-foreground/40">
                              reste {opt.remaining}
                            </span>
                          )
                        )}
                      </span>
                      <div className="flex items-center gap-2">
                        {onRestocked && opt.stockQuantity != null && (
                          <RestockControl
                            body={{
                              target: 'option',
                              productId: activeProduct.id,
                              groupName: group.name,
                              optionName: opt.name,
                            }}
                            currentStock={opt.remaining ?? opt.stockQuantity}
                            onDone={(stock) =>
                              handleOptionRestocked(group.name, opt.name, stock)
                            }
                          />
                        )}
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
