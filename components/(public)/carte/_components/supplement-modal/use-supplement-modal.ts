'use client';

import { useEffect, useRef } from 'react';
import { trackAddToCart, trackViewItem } from '@/lib/analytics';
import { formatSupplementLabel } from '@/lib/orders/format';
import { useCartStore } from '@/lib/cart-store';
import {
  buildInitialSelections,
  canSubmitSelections,
  getSelectedSupplements,
  getSupplementsPrice,
  groupSelectionCount,
  isFixedPortionGroup,
  isGroupValid,
  multipleSelection,
  portionCount,
  stripPortionSuffix,
  type Selections,
} from '@/lib/supplements';
import { useResettableState } from '@/lib/hooks/use-resettable-state';
import { CART_ITEM_QUANTITY_MAX } from '@/config/constants';
import type { SupplementModalProps } from './types';

export type SupplementModalState = ReturnType<typeof useSupplementModal>;

export function useSupplementModal({
  product,
  isOpen,
  onClose,
  initialSupplements,
  editToken,
  onConfirm,
  strictStock = false,
  initialQuantity = 1,
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
  const [quantity, setQuantity] = useResettableState<number>(
    resetKey,
    () => initialQuantity
  );

  // `view_item` : ouvrir la modale d'options est la consultation de fiche
  // produit la plus proche qu'offre le site (la carte est une liste unique).
  // Couvre aussi les liens partagés `/carte?p=<id>`, qui montent cette même
  // modale (voir _components/product-deep-link.tsx). La ref neutralise le
  // double appel des effets sous StrictMode en développement.
  const viewedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isOpen) {
      viewedRef.current = null;
      return;
    }
    if (viewedRef.current === product.id) return;
    viewedRef.current = product.id;
    trackViewItem({
      item_id: product.id,
      item_name: product.name,
      price: product.price,
      quantity: 1,
    });
  }, [isOpen, product.id, product.name, product.price]);

  function toggleGroup(groupName: string) {
    setOpenGroups((prev) => ({ ...prev, [groupName]: !prev[groupName] }));
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

  // Le produit lui-même est épuisé : toute la ligne part « pour un autre
  // jour », donc ses goûts épuisés le sont aussi. Les goûts épuisés d'un
  // produit DISPONIBLE, eux, restent sélectionnables pour la même raison —
  // c'est le sélecteur de créneau qui traduira ça en « pas aujourd'hui ».
  // Sauf en `strictStock` (remplacement pour un retrait immédiat) : là, un
  // goût épuisé ne compte pas — et la MÊME constante alimente les quatre
  // helpers ci-dessous, sans quoi un goût validé à l'écran disparaîtrait à
  // l'ajout.
  const rules = { ignoreSoldOut: !strictStock };

  const canSubmit = canSubmitSelections(product, selections, rules);

  // La ligne part-elle « pour un autre jour » ? Uniquement si le produit est
  // épuisé, ou si le client a EFFECTIVEMENT choisi un goût épuisé — pas parce
  // qu'un goût épuisé existe quelque part dans la carte. Dérivé de la
  // sélection courante : cocher puis décocher « Vanille » ne doit pas laisser
  // la commande contrainte à demain.
  const soldOutForLater =
    product.soldOut === true ||
    getSelectedSupplements(product, selections, rules).some((sup) =>
      (product.supplements ?? []).some(
        (g) =>
          g.name === sup.groupName &&
          g.options.some((o) => o.name === sup.optionName && o.soldOut)
      )
    );
  // Premier groupe qui bloque l'envoi : le CTA le nomme, au lieu de rester
  // gris sans dire ce qui manque. Sur une boîte à parts fixes on va plus loin
  // et on chiffre le reste à faire (« Encore 2 parts à choisir »).
  const blockingGroup = groups.find((g) => !isGroupValid(g, selections, rules));
  const blockingLabel = (() => {
    if (!blockingGroup) return 'Choisissez vos options';
    if (isFixedPortionGroup(blockingGroup)) {
      const missing =
        portionCount(blockingGroup) -
        groupSelectionCount(blockingGroup, selections, rules);
      return `Encore ${missing} part${missing > 1 ? 's' : ''} à choisir`;
    }
    return `Choisissez : ${stripPortionSuffix(blockingGroup.name)}`;
  })();

  const unitPrice =
    product.price +
    getSupplementsPrice(getSelectedSupplements(product, selections, rules));
  const runningTotal = unitPrice * quantity;

  // Plafond de la ligne : stock restant du produit s'il est suivi, sinon le
  // garde-fou métier général. Le store re-plafonne de toute façon à l'ajout.
  // Un article commandé « pour un autre jour » n'est pas plafonné par le stock
  // du jour : il n'existe pas encore, il sera produit.
  const maxQuantity = Math.max(
    1,
    Math.min(
      soldOutForLater
        ? CART_ITEM_QUANTITY_MAX
        : (product.remaining ?? CART_ITEM_QUANTITY_MAX),
      CART_ITEM_QUANTITY_MAX
    )
  );

  function handleAdd() {
    if (!canSubmit) return;
    const supplements = getSelectedSupplements(product, selections, rules);
    const item = {
      productId: product.id,
      productName: product.name,
      basePrice: product.price,
      coutMatiere: product.coutMatiere ?? 0,
      coutEmballage: product.coutEmballage ?? 0,
      supplements,
      advanceOrderDays: product.advanceOrderDays,
      availableDays: product.availableDays,
      weeklySpecialPeriods: product.weeklySpecialPeriods,
      soldOutToday: soldOutForLater || undefined,
      requiresDeposit: product.requiresDeposit,
    };
    // Pas de plafond quand l'article part pour un autre jour : `addItem`
    // refuse SILENCIEUSEMENT un ajout avec `maxQuantity <= 0`.
    const stockCap = soldOutForLater
      ? undefined
      : (product.remaining ?? undefined);
    if (onConfirm) {
      onConfirm(item, quantity, stockCap);
    } else {
      // `addItem` ajoute une unité et fusionne les lignes strictement
      // identiques : N appels donnent bien UNE ligne à quantité N, tout en
      // conservant le plafond de stock du store.
      for (let i = 0; i < quantity; i++) addItem(item, stockCap);
    }
    // Un seul événement pour le geste, suppléments inclus dans `item_variant`
    // et prix unitaire options comprises (cf. lib/analytics.ts).
    trackAddToCart([
      {
        item_id: product.id,
        item_name: product.name,
        ...(supplements.length > 0
          ? { item_variant: supplements.map(formatSupplementLabel).join(', ') }
          : {}),
        price: product.price + getSupplementsPrice(supplements),
        quantity,
      },
    ]);
    setSelections(() => buildInitialSelections(product, []));
    setQuantity(() => 1);
    onClose();
  }

  return {
    product,
    productGroups,
    globalGroups,
    selections,
    setSelections,
    openGroups,
    showExtras,
    setShowExtras,
    quantity,
    setQuantity,
    rules,
    strictStock,
    canSubmit,
    soldOutForLater,
    blockingLabel,
    runningTotal,
    maxQuantity,
    toggleGroup,
    setSingle,
    toggleMultiple,
    setOptionQuantity,
    handleAdd,
  };
}
