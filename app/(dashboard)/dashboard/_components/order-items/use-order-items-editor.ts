'use client';

import { useMemo, useState, useTransition } from 'react';
import { type CartItem, type CartItemSupplement } from '@/lib/cart-store';
import { type MenuCategory, type Product } from '@/config/menu';
import { computeItemsTotal } from '@/lib/orders/totals';
import { productNeedsPicker } from '@/lib/catalog';
import { useLiveMenu } from '@/lib/hooks/use-live-menu';
import { updateOrderItemsAction } from '../../commandes/actions';
import { useConfirmDialog } from '../use-confirm-dialog';
import { useShortageConfirm } from '../use-shortage-confirm';
import {
  hasRemovedSomething,
  makeCartId,
  supplementsKey,
  type PickerState,
} from './helpers';

export function useOrderItemsEditor({
  orderId,
  initialItems,
  menu: initialMenu,
  stockReserved,
  onClose,
}: {
  orderId: string;
  initialItems: CartItem[];
  menu: MenuCategory[];
  stockReserved: boolean;
  onClose: () => void;
}) {
  const [items, setItems] = useState<CartItem[]>(initialItems);
  const [view, setView] = useState<'list' | 'catalog'>('list');
  const [picker, setPicker] = useState<PickerState | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Menu « live » : une réappro faite ici ou ailleurs se reflète sans recharger.
  const { menu, applyRestock } = useLiveMenu(initialMenu);
  const { confirm, confirmDialog } = useConfirmDialog();
  const { confirmShortage, shortageDialog } = useShortageConfirm();

  // Index produit par id : les lignes ne stockent que les options choisies, pas les groupes.
  const productById = useMemo(() => {
    const map = new Map<string, Product>();
    for (const cat of menu) for (const p of cat.products) map.set(p.id, p);
    return map;
  }, [menu]);

  function changeQty(cartId: string, delta: number) {
    setItems((prev) =>
      prev
        .map((i) =>
          i.cartId === cartId ? { ...i, quantity: i.quantity + delta } : i
        )
        .filter((i) => i.quantity > 0)
    );
  }

  function removeItem(cartId: string) {
    setItems((prev) => prev.filter((i) => i.cartId !== cartId));
  }

  function setItemDiscount(
    cartId: string,
    discount: number,
    reason: string | null
  ) {
    setItems((prev) =>
      prev.map((i) =>
        i.cartId === cartId ? { ...i, discount, discountReason: reason } : i
      )
    );
  }

  // Toujours une nouvelle ligne `addedLater` (jamais fusionnée avec l'origine) ; re-taper le même produit incrémente.
  function addLine(product: Product, supplements: CartItemSupplement[]) {
    setItems((prev) => {
      const key = supplementsKey(supplements);
      const existing = prev.find(
        (i) =>
          i.addedLater &&
          i.productId === product.id &&
          supplementsKey(i.supplements) === key
      );
      if (existing) {
        return prev.map((i) =>
          i.cartId === existing.cartId ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      const item: CartItem = {
        cartId: makeCartId(),
        productId: product.id,
        productName: product.name,
        basePrice: product.price,
        coutMatiere: product.coutMatiere ?? 0,
        coutEmballage: product.coutEmballage ?? 0,
        quantity: 1,
        supplements,
        addedLater: true,
      };
      return [...prev, item];
    });
  }

  // Comme à la caisse : le sélecteur ne s'ouvre que si le produit impose un choix (extras globaux via le bouton « Options »).
  function handleProductTap(product: Product) {
    if (productNeedsPicker(product)) {
      setPicker({ mode: 'add', product });
      return;
    }
    addLine(product, []);
    setView('list');
  }

  function editLineOptions(item: CartItem) {
    const product = productById.get(item.productId);
    if (!product) return;
    setPicker({ mode: 'edit', product, cartId: item.cartId });
  }

  // Ajoute UN exemplaire avec des suppléments éventuellement différents (sélecteur pré-rempli) ; `addLine` fusionne si identique.
  function duplicateLineWithOptions(item: CartItem) {
    const product = productById.get(item.productId);
    if (!product) return;
    setPicker({ mode: 'duplicate', product, cartId: item.cartId });
  }

  function handlePickerConfirm(
    product: Product,
    supplements: CartItemSupplement[]
  ) {
    if (picker?.mode === 'edit') {
      const { cartId } = picker;
      setItems((prev) =>
        prev.map((i) => (i.cartId === cartId ? { ...i, supplements } : i))
      );
    } else {
      addLine(product, supplements);
      if (picker?.mode === 'add') setView('list');
    }
    setPicker(null);
  }

  async function save() {
    if (items.length === 0) {
      setError('La commande doit contenir au moins un article');
      return;
    }
    setError(null);

    // Un article retiré d'une commande déjà en cuisine revient au stock par défaut, mais il a pu être préparé : on demande.
    let restoreRemovedStock = true;
    if (stockReserved && hasRemovedSomething(items, initialItems)) {
      restoreRemovedStock = await confirm({
        title: 'Remettre en stock ?',
        message:
          'Cette commande est déjà partie en cuisine. Les articles retirés ont-ils déjà été préparés ?\n\n' +
          '« Remettre en stock » les rend vendables ; « Déjà préparé » les laisse décomptés.',
        confirmLabel: 'Remettre en stock',
        cancelLabel: 'Déjà préparé',
      });
    }

    startTransition(async () => {
      try {
        let result = await updateOrderItemsAction(orderId, items, {
          restoreRemovedStock,
        });
        // Pénurie sur l'ajout : proposer d'enregistrer la production sur place.
        if (
          result?.shortage?.length &&
          (await confirmShortage(result.shortage))
        ) {
          result = await updateOrderItemsAction(orderId, items, {
            restoreRemovedStock,
            coverShortage: true,
          });
        }
        if (result?.error) {
          setError(result.error);
          return;
        }
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur');
      }
    });
  }
  const total = computeItemsTotal(items);

  // 'edit' ET 'duplicate' pré-remplissent depuis la même ligne source ; seul 'add' (depuis le catalogue) part de zéro.
  const sourceItem =
    picker?.mode === 'edit' || picker?.mode === 'duplicate'
      ? items.find((i) => i.cartId === picker.cartId)
      : undefined;

  return {
    items,
    view,
    setView,
    picker,
    setPicker,
    isPending,
    error,
    menu,
    applyRestock,
    confirmDialog,
    shortageDialog,
    productById,
    changeQty,
    removeItem,
    setItemDiscount,
    handleProductTap,
    editLineOptions,
    duplicateLineWithOptions,
    handlePickerConfirm,
    save,
    total,
    sourceItem,
  };
}

export type OrderItemsEditorState = ReturnType<typeof useOrderItemsEditor>;
