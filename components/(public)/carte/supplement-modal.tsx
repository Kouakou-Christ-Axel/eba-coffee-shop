// components/(public)/carte/supplement-modal.tsx
'use client';

import {
  Modal,
  ModalContent,
  ModalBody,
  ModalFooter,
  Button,
  RadioGroup,
  Radio,
  Checkbox,
} from '@heroui/react';
import { ChevronDown, Minus, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCartStore, type CartItemSupplement } from '@/lib/cart-store';
import {
  priceFormatter,
  type Product,
  type SupplementGroup,
} from '@/config/menu';
import {
  buildInitialSelections,
  canSubmitSelections,
  effectiveMax,
  getSelectedSupplements,
  getSupplementsPrice,
  groupConstraintLabel,
  groupSelectionCount,
  isFixedPortionGroup,
  isGroupValid,
  optionQuantity,
  portionCount,
  stripPortionSuffix,
  type Selections,
} from '@/lib/supplements';
import { PortionComposer } from './_components/portion-composer';
import { useResettableState } from '@/lib/hooks/use-resettable-state';
import { CART_ITEM_QUANTITY_MAX } from '@/config/constants';
import {
  ProductBadge,
  ProductMedia,
  productBadgeLabel,
} from './_components/product-media';
import {
  BOTTOM_SHEET_PLACEMENT,
  SHEET_OVERLAY_TOP,
  bottomSheetClassNames,
} from './_components/bottom-sheet';

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

/** Options épuisées reléguées en fin de groupe : elles restent consultables
 * (le client voit que le goût existe) sans encombrer les choix disponibles. */
function orderableFirst(options: SupplementGroup['options']) {
  return [...options].sort(
    (a, b) => Number(a.soldOut ?? false) - Number(b.soldOut ?? false)
  );
}

/** Aperçu vendeur des extras : « Chantilly +300 F · Shot espresso +300 F ».
 * Le repli des extras répond à un vrai problème (listes trop longues pour
 * finir une commande) — mais un bouton muet ne vend rien. On garde le repli
 * et on montre le contenu. */
function extrasPreview(groups: SupplementGroup[], max = 3): string {
  return groups
    .flatMap((g) => g.options)
    .filter((o) => !o.soldOut && o.price > 0)
    .slice(0, max)
    .map((o) => `${o.name} +${priceFormatter.format(o.price)} F`)
    .join(' · ');
}

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
  // Quantité de la modale : sans elle, commander trois fois le même gâteau
  // impose de rouvrir et reconfigurer la modale trois fois.
  const [quantity, setQuantity] = useResettableState<number>(resetKey, () => 1);

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

  function setOptionQuantity(
    groupName: string,
    optionName: string,
    delta: number
  ) {
    setSelections((prev) => {
      const cur = (prev[groupName] as Record<string, number>) ?? {};
      const next = Math.max(0, (cur[optionName] ?? 0) + delta);
      return { ...prev, [groupName]: { ...cur, [optionName]: next } };
    });
  }

  const canSubmit = canSubmitSelections(product, selections);
  // Premier groupe qui bloque l'envoi : le CTA le nomme, au lieu de rester
  // gris sans dire ce qui manque. Sur une boîte à parts fixes on va plus loin
  // et on chiffre le reste à faire (« Encore 2 parts à choisir »).
  const blockingGroup = groups.find((g) => !isGroupValid(g, selections));
  const blockingLabel = (() => {
    if (!blockingGroup) return 'Choisissez vos options';
    if (isFixedPortionGroup(blockingGroup)) {
      const missing =
        portionCount(blockingGroup) -
        groupSelectionCount(blockingGroup, selections);
      return `Encore ${missing} part${missing > 1 ? 's' : ''} à choisir`;
    }
    return `Choisissez : ${stripPortionSuffix(blockingGroup.name)}`;
  })();

  const unitPrice =
    product.price +
    getSupplementsPrice(getSelectedSupplements(product, selections, false));
  const runningTotal = unitPrice * quantity;

  // Plafond de la ligne : stock restant du produit s'il est suivi, sinon le
  // garde-fou métier général. Le store re-plafonne de toute façon à l'ajout.
  const maxQuantity = Math.max(
    1,
    Math.min(
      product.remaining ?? CART_ITEM_QUANTITY_MAX,
      CART_ITEM_QUANTITY_MAX
    )
  );

  function handleAdd() {
    if (!canSubmit) return;
    const supplements = getSelectedSupplements(product, selections, false);
    // `addItem` ajoute une unité et fusionne les lignes strictement identiques :
    // N appels donnent bien UNE ligne à quantité N, tout en conservant le
    // plafond de stock du store. Pas besoin de toucher lib/cart-store.ts.
    for (let i = 0; i < quantity; i++) {
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
          supplements,
        },
        product.remaining ?? undefined
      );
    }
    setSelections(() => buildInitialSelections(product, []));
    setQuantity(() => 1);
    onClose();
  }

  const badge = productBadgeLabel(product);
  const preview = extrasPreview(globalGroups);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      // Bottom sheet plein écran sur mobile, dialogue centré sur desktop
      // (voir _components/bottom-sheet.ts).
      placement={BOTTOM_SHEET_PLACEMENT}
      size="md"
      scrollBehavior="inside"
      // La photo est collée aux bords : pas de padding d'en-tête, et le bouton
      // de fermeture par défaut passerait dessous — on le remplace par le
      // nôtre, posé en overlay sur l'image.
      hideCloseButton
      classNames={bottomSheetClassNames({ body: 'px-0 py-0' })}
    >
      <ModalContent>
        <ModalBody className="gap-0">
          {/* Le client configure un produit : il doit le VOIR. La feuille
              occupant tout l'écran sur mobile, la photo peut y être plus
              généreuse que dans le dialogue de bureau. */}
          <div className="relative h-64 w-full shrink-0 overflow-hidden sm:h-56">
            <ProductMedia
              product={product}
              sizes="(max-width: 640px) 100vw, 448px"
              monogramClassName="text-6xl"
            />
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-20 bg-[linear-gradient(180deg,rgba(0,0,0,0.35)_0%,transparent_100%)]"
            />
            <Button
              isIconOnly
              size="sm"
              radius="full"
              aria-label="Fermer"
              onPress={onClose}
              className={cn(
                'absolute right-3 min-h-9 min-w-9 bg-white/90 text-foreground shadow-md',
                SHEET_OVERLAY_TOP
              )}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Le badge ouvre le bloc texte, sous la photo : en overlay il
              masquait une partie du visuel qui doit donner envie, et sa
              lisibilité dépendait de ce qu'il y avait dessous. */}
          <div className="px-6 pb-2 pt-4">
            {badge && <ProductBadge label={badge} className="mb-1.5" />}
            <h2 className="text-xl font-semibold tracking-tight">
              {product.name}
            </h2>
            <p className="mt-1 text-base font-bold text-primary">
              {priceFormatter.format(product.price)}&nbsp;F
            </p>
            {/* La description vend le produit : elle disparaissait justement au
                moment de la décision. */}
            {product.description && (
              <p className="mt-2 text-sm leading-relaxed text-foreground/65">
                {product.description}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3 px-6 pb-6 pt-2">
            {productGroups.map((group) => renderGroup(group))}

            {globalGroups.length > 0 &&
              (showExtras ? (
                <div className="space-y-3 border-t pt-3">
                  <p className="text-xs font-semibold tracking-wide text-foreground/40 uppercase">
                    Envie d’un petit plus ?
                  </p>
                  {globalGroups.map((group) => renderGroup(group))}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowExtras(() => true)}
                  className="w-full cursor-pointer rounded-xl border border-dashed border-primary/30 bg-primary/[0.04] px-3 py-2.5 text-left transition-colors hover:bg-primary/[0.08]"
                >
                  <span className="text-sm font-semibold text-primary">
                    Envie d’un petit plus ?
                  </span>
                  {preview && (
                    <span className="mt-0.5 block truncate text-xs text-foreground/55">
                      {preview}
                    </span>
                  )}
                </button>
              ))}
          </div>
        </ModalBody>

        <ModalFooter className="gap-3">
          {/* Sélecteur de quantité : le levier le plus direct sur le panier
              moyen — un client qui veut 3 parts ne doit pas refaire 3 fois le
              parcours. */}
          <div className="flex shrink-0 items-center gap-1 rounded-full border border-foreground/10 p-1">
            <Button
              isIconOnly
              size="sm"
              variant="light"
              radius="full"
              aria-label="Diminuer la quantité"
              isDisabled={quantity <= 1}
              onPress={() => setQuantity((q) => Math.max(1, q - 1))}
            >
              <Minus className="size-3.5" />
            </Button>
            <span
              aria-live="polite"
              className="w-6 text-center text-sm font-semibold"
            >
              {quantity}
            </span>
            <Button
              isIconOnly
              size="sm"
              variant="light"
              radius="full"
              aria-label="Augmenter la quantité"
              isDisabled={quantity >= maxQuantity}
              onPress={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
            >
              <Plus className="size-3.5" />
            </Button>
          </div>

          <Button
            color="primary"
            className="flex-1"
            size="lg"
            onPress={handleAdd}
            isDisabled={!canSubmit}
          >
            {canSubmit
              ? `Ajouter — ${priceFormatter.format(runningTotal)} F`
              : blockingLabel}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );

  function renderGroup(group: SupplementGroup) {
    // Boîte à parts fixes (« Sponge Cake x4 ») : composeur à emplacements
    // plutôt qu'une liste de compteurs — et jamais replié, c'est LE choix
    // structurant du produit, pas une option accessoire.
    if (isFixedPortionGroup(group)) {
      return (
        <PortionComposer
          key={group.name}
          group={group}
          selections={selections}
          combos={product.portionCombos}
          onCountsChange={(next) =>
            setSelections((prev) => ({ ...prev, [group.name]: next }))
          }
        />
      );
    }

    const constraint = groupConstraintLabel(group);
    const count = groupSelectionCount(group, selections);
    const max = effectiveMax(group);
    const isOpen = openGroups[group.name] ?? false;
    const options = orderableFirst(group.options);

    return (
      <div key={group.name} className="rounded-xl border border-foreground/10">
        <button
          type="button"
          onClick={() => toggleGroup(group.name)}
          className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2.5 text-left"
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
                {options.map((opt) => (
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
                      {/* Le prix d'une option payante est un argument : on le
                          traite en secondary plutôt qu'en gris de formulaire. */}
                      <span
                        className={
                          opt.price === 0
                            ? 'text-xs text-foreground/50'
                            : 'text-xs font-semibold text-secondary-600'
                        }
                      >
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
                {options.map((opt) => {
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
                        <span className="text-xs font-semibold text-secondary-600">
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
                {options.map((opt) => {
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
                          <span className="ml-1 text-xs font-semibold text-secondary-600">
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
                          onPress={() =>
                            setOptionQuantity(group.name, opt.name, -1)
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
                            setOptionQuantity(group.name, opt.name, 1)
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
          </div>
        )}
      </div>
    );
  }
}

export default SupplementModal;
