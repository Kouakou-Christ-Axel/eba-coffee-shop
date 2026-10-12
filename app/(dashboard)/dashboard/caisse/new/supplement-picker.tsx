'use client';

import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from '@heroui/react';
import { priceFormatter, type Product } from '@/config/menu';
import { type CartItemSupplement } from '@/lib/cart-store';
import {
  buildInitialSelections,
  canSubmitSelections,
  getSelectedSupplements,
  getSupplementsPrice,
  multipleSelection,
  type Selections,
} from '@/lib/supplements';
import { useResettableState } from '@/lib/hooks/use-resettable-state';
import { applyOptionStock } from '@/lib/caisse-restock';
import { SupplementGroupCard } from './_components/picker/supplement-group-card';
import type { PickerCtx } from './_components/picker/types';

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
  /** Réappro depuis le sélecteur (recréditer un goût épuisé) : un bouton apparaît sur chaque goût à stock suivi ; le parent synchronise son menu. */
  onRestocked?: (
    groupName: string,
    optionName: string,
    stockQuantity: number | null
  ) => void;
  /** Commande pour un jour civil ultérieur : les goûts épuisés redeviennent sélectionnables et ne sont plus retirés silencieusement (cf. `SupplementRules`). */
  forFutureDay?: boolean;
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
  forFutureDay = false,
}: Props) {
  // Une seule valeur de règles pour toutes les fonctions de `lib/supplements.ts` (comptage, validation, conversion en ligne) : sinon un goût validé à l'écran disparaîtrait à l'ajout.
  const rules = { ignoreSoldOut: forFutureDay };
  const resetKey = `${product?.id ?? ''}::${editToken ?? ''}`;

  const [selections, setSelections] = useResettableState<Selections>(
    resetKey,
    () => buildInitialSelections(product, initialSupplements ?? [])
  );
  // Copie « live » du produit : la réappro d'un goût met à jour le stock ici sans rechargement.
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
      const cur = multipleSelection(prev, groupName);
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
    if (!canSubmitSelections(activeProduct, selections, rules)) return;
    onAdd({
      product: activeProduct,
      supplements: getSelectedSupplements(activeProduct, selections, rules),
    });
    onClose();
  }

  const runningTotal =
    activeProduct.price +
    getSupplementsPrice(
      getSelectedSupplements(activeProduct, selections, rules)
    );

  const pickerCtx: PickerCtx = {
    activeProduct,
    selections,
    rules,
    forFutureDay,
    hasRestock: Boolean(onRestocked),
    setSingle,
    toggleMultiple,
    setQuantity,
    handleOptionRestocked,
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      placement="center"
      size="md"
      scrollBehavior="inside"
    >
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
            isDisabled={!canSubmitSelections(activeProduct, selections, rules)}
          >
            {confirmVerb} — {priceFormatter.format(runningTotal)} F
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );

  function renderGroup(group: (typeof groups)[number]) {
    return (
      <SupplementGroupCard
        key={group.name}
        group={group}
        ctx={pickerCtx}
        isOpen={openGroups[group.name] ?? false}
        onToggle={() => toggleGroup(group.name)}
      />
    );
  }
}
