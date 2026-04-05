'use client';

import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from '@heroui/react';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { useCartStore, getItemTotal } from '@/lib/cart-store';
import { priceFormatter } from '@/config/menu';
import { buildWhatsAppUrl } from '@/lib/cart-to-whatsapp';

type CartDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
};

function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearCart = useCartStore((s) => s.clearCart);
  const totalPrice = items.reduce((sum, i) => sum + getItemTotal(i), 0);

  function handleOrder() {
    const url = buildWhatsAppUrl(items);
    window.open(url, '_blank');
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      placement="center"
      size="lg"
      scrollBehavior="inside"
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
              {items.map((item) => (
                <div
                  key={item.cartId}
                  className="flex items-start gap-3 py-4 first:pt-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {item.productName}
                    </p>
                    {item.supplements.length > 0 && (
                      <p className="mt-0.5 text-xs text-foreground/45">
                        {item.supplements.map((s) => s.optionName).join(', ')}
                      </p>
                    )}
                    <p className="mt-1 text-sm font-medium text-primary">
                      {priceFormatter.format(getItemTotal(item))}&nbsp;F
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      isIconOnly
                      size="sm"
                      variant="flat"
                      radius="full"
                      aria-label="Retirer un"
                      onPress={() =>
                        updateQuantity(item.cartId, item.quantity - 1)
                      }
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
                      aria-label="Ajouter un"
                      onPress={() =>
                        updateQuantity(item.cartId, item.quantity + 1)
                      }
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      radius="full"
                      color="danger"
                      aria-label="Supprimer"
                      onPress={() => removeItem(item.cartId)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
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
              onPress={handleOrder}
            >
              Commander via WhatsApp
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
  );
}

export default CartDrawer;
