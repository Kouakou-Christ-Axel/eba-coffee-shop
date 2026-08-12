'use client';

import { useEffect, useState } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from '@heroui/react';
import { Copy, Minus, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCartStore, getItemTotal, type CartItem } from '@/lib/cart-store';
import { priceFormatter, type MenuCategory, type Product } from '@/config/menu';
import { formatSupplementLabel } from '@/lib/orders/format';
import {
  cartItemToAnalyticsItem,
  trackBeginCheckout,
  trackRemoveFromCart,
} from '@/lib/analytics';
import SupplementModal from './supplement-modal';
import { ProductMedia } from './_components/product-media';
import { CartUpsell, selectUpsellProducts } from './_components/cart-upsell';
import {
  BOTTOM_SHEET_PLACEMENT,
  bottomSheetClassNames,
} from './_components/bottom-sheet';

type CartDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
};

// Récapitulatif du panier (liste + total). La saisie des informations de
// retrait/livraison se fait sur une page dédiée (/carte/commande) plutôt
// qu'ici — plus confortable pour remplir un formulaire sur mobile qu'un
// step imbriqué dans cette modal.
function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearCart = useCartStore((s) => s.clearCart);
  const totalPrice = items.reduce((sum, i) => sum + getItemTotal(i), 0);

  // Menu chargé à la demande (le panier flottant n'a pas accès au menu de la
  // page /carte) : uniquement pour retrouver les groupes de suppléments d'un
  // produit et proposer « Dupliquer avec des suppléments différents ».
  const [menu, setMenu] = useState<MenuCategory[] | null>(null);
  useEffect(() => {
    if (!isOpen || menu) return;
    fetch('/api/menu')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: MenuCategory[] | null) => setMenu(data ?? []))
      .catch(() => setMenu([]));
  }, [isOpen, menu]);

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

  // Suggestions calculées sur le menu déjà chargé pour les suppléments : la
  // vente additionnelle ne coûte aucune requête supplémentaire.
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
    // Une unité retirée sur N : on ne remonte que celle-là, pas la ligne entière.
    trackRemoveFromCart([{ ...cartItemToAnalyticsItem(item), quantity: 1 }]);
    updateQuantity(item.cartId, item.quantity - 1);
  }

  function goToCheckout() {
    // `begin_checkout` est posé sur l'intention (le clic), et non au montage de
    // /carte/commande : pas de garde StrictMode à prévoir, et un rechargement
    // de la page de commande ne recompte pas un nouveau départ de tunnel.
    trackBeginCheckout(items.map(cartItemToAnalyticsItem));
    onClose();
    router.push('/carte/commande');
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        // Bottom sheet plein écran sur mobile, dialogue centré sur desktop
        // (voir _components/bottom-sheet.ts).
        placement={BOTTOM_SHEET_PLACEMENT}
        size="lg"
        scrollBehavior="inside"
        classNames={bottomSheetClassNames()}
      >
        <ModalContent>
          <ModalHeader>
            <span className="text-lg font-semibold">Votre commande</span>
          </ModalHeader>

          <ModalBody>
            {items.length === 0 ? (
              <p className="py-8 text-center text-sm text-foreground/50">
                Votre panier est vide
              </p>
            ) : (
              <div className="divide-y divide-foreground/5">
                {items.map((item) => {
                  const product = findProduct(item.productId);
                  return (
                    <div
                      key={item.cartId}
                      className="flex items-start gap-3 py-4 first:pt-0"
                    >
                      {/* Vignette : rappel visuel de ce qu'on s'apprête à payer.
                        Le produit peut être absent tant que /api/menu n'a pas
                        répondu — la ligne reste alors purement textuelle. */}
                      {product && (
                        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                          <ProductMedia
                            product={product}
                            sizes="64px"
                            monogramClassName="text-2xl"
                          />
                        </div>
                      )}

                      {/* Nom, prix et commandes empilés dans UNE colonne : sur
                          un écran de 390 px, mettre le sélecteur de quantité
                          en troisième colonne ne laissait plus assez de place
                          au reste (le lien « autres options » se cassait sur
                          trois lignes). */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground">
                              {item.productName}
                            </p>
                            {item.supplements.length > 0 && (
                              <p className="mt-0.5 text-xs text-foreground/45">
                                {item.supplements
                                  .map(formatSupplementLabel)
                                  .join(', ')}
                              </p>
                            )}
                            <p className="mt-1 text-sm font-medium text-primary">
                              {priceFormatter.format(getItemTotal(item))}
                              &nbsp;F
                            </p>
                          </div>

                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            radius="full"
                            color="danger"
                            aria-label={`Supprimer ${item.productName}`}
                            onPress={() => removeLine(item)}
                            className="shrink-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="flex shrink-0 items-center gap-1.5">
                            <Button
                              isIconOnly
                              size="sm"
                              variant="flat"
                              radius="full"
                              aria-label={`Retirer un ${item.productName}`}
                              onPress={() => decrementLine(item)}
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </Button>
                            <span className="w-6 text-center text-sm font-medium">
                              {item.quantity}
                            </span>
                            <Button
                              isIconOnly
                              size="sm"
                              variant="flat"
                              radius="full"
                              aria-label={`Ajouter un ${item.productName}`}
                              onPress={() =>
                                updateQuantity(item.cartId, item.quantity + 1)
                              }
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </div>

                          {hasOptions(item.productId) && (
                            <button
                              type="button"
                              onClick={() => setDuplicateItem(item)}
                              className="inline-flex min-w-0 cursor-pointer items-center gap-1 text-xs text-foreground/50 transition-colors hover:text-foreground"
                            >
                              <Copy className="h-3 w-3 shrink-0" />
                              <span className="truncate">Autres options</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {items.length > 0 && <CartUpsell products={upsellProducts} />}
          </ModalBody>

          {items.length > 0 && (
            <ModalFooter className="flex-col gap-3">
              <div className="flex w-full items-center justify-between">
                <span className="text-base font-semibold">Total</span>
                <span className="text-lg font-bold text-primary">
                  {priceFormatter.format(totalPrice)}&nbsp;F
                </span>
              </div>

              <Button
                color="primary"
                className="w-full"
                size="lg"
                onPress={goToCheckout}
              >
                Passer la commande
              </Button>

              <button
                onClick={() => {
                  clearCart();
                  onClose();
                }}
                className="text-xs text-foreground/40 transition-colors hover:text-destructive"
              >
                Vider le panier
              </button>
            </ModalFooter>
          )}
        </ModalContent>
      </Modal>

      {duplicateProduct && (
        <SupplementModal
          product={duplicateProduct}
          isOpen={duplicateItem !== null}
          onClose={() => setDuplicateItem(null)}
          initialSupplements={duplicateItem?.supplements ?? []}
          editToken={duplicateItem?.cartId}
        />
      )}
    </>
  );
}

export default CartDrawer;
