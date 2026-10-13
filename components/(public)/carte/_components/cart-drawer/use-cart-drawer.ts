import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore, getItemTotal, type CartItem } from '@/lib/cart-store';
import type { MenuCategory, Product } from '@/config/menu';
import {
  cartItemToAnalyticsItem,
  trackBeginCheckout,
  trackRemoveFromCart,
} from '@/lib/analytics';
import { useCartAvailability } from '@/lib/hooks/use-cart-availability';
import { selectUpsellProducts } from '../cart-upsell';
import { isPrecommandeCart } from '@/lib/cart-precommande';

export function useCartDrawer(isOpen: boolean, onClose: () => void) {
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearCart = useCartStore((s) => s.clearCart);
  const totalPrice = items.reduce((sum, i) => sum + getItemTotal(i), 0);

  // Menu chargé à la demande (le panier flottant n'a pas accès au menu de
  // /carte) : groupes de suppléments, doublon d'une ligne, suggestions.
  const [menu, setMenu] = useState<MenuCategory[] | null>(null);
  useEffect(() => {
    if (!isOpen || menu) return;
    fetch('/api/menu')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: MenuCategory[] | null) => setMenu(data ?? []))
      .catch(() => setMenu([]));
  }, [isOpen, menu]);

  // Une rupture survenue depuis l'ajout se voit ICI, pas au clic sur « Confirmer ».
  const availability = useCartAvailability(menu);
  const soldOutCount = availability?.soldOutLines.length ?? 0;
  const goneCount = availability?.goneCartIds.length ?? 0;

  const precommande = isPrecommandeCart(items);

  const [duplicateItem, setDuplicateItem] = useState<CartItem | null>(null);
  const duplicateProduct: Product | null = duplicateItem
    ? (menu
        ?.flatMap((cat) => cat.products)
        .find((p) => p.id === duplicateItem.productId) ?? null)
    : null;

  function findProduct(productId: string): Product | null {
    return (
      menu?.flatMap((cat) => cat.products).find((p) => p.id === productId) ??
      null
    );
  }

  function hasOptions(productId: string): boolean {
    return (findProduct(productId)?.supplements?.length ?? 0) > 0;
  }

  // Calculées sur le menu déjà chargé : aucune requête supplémentaire.
  const upsellProducts = menu
    ? selectUpsellProducts(
        menu,
        items.map((i) => i.productId)
      )
    : [];

  /** Retrait d'une ligne, par la corbeille ou par un décrément qui atteint 0. */
  function removeLine(item: CartItem) {
    trackRemoveFromCart([cartItemToAnalyticsItem(item)]);
    removeItem(item.cartId);
  }

  function decrementLine(item: CartItem) {
    if (item.quantity <= 1) {
      removeLine(item);
      return;
    }
    // Une unité retirée sur N : on ne remonte que celle-là.
    trackRemoveFromCart([{ ...cartItemToAnalyticsItem(item), quantity: 1 }]);
    updateQuantity(item.cartId, item.quantity - 1);
  }

  function goToCheckout() {
    // `begin_checkout` posé sur l'intention (le clic), pas au montage de la page.
    trackBeginCheckout(items.map(cartItemToAnalyticsItem));
    onClose();
    router.push('/carte/commande');
  }

  function clearAndClose() {
    clearCart();
    onClose();
  }

  return {
    items,
    updateQuantity,
    totalPrice,
    availability,
    soldOutCount,
    goneCount,
    precommande,
    duplicateItem,
    setDuplicateItem,
    duplicateProduct,
    findProduct,
    hasOptions,
    upsellProducts,
    removeLine,
    decrementLine,
    goToCheckout,
    clearAndClose,
  };
}

export type CartDrawerState = ReturnType<typeof useCartDrawer>;
