'use client';

import { Modal, ModalContent, ModalHeader, ModalBody } from '@heroui/react';
import SupplementModal from './supplement-modal';
import { CartUpsell } from './_components/cart-upsell';
import { CartFooter } from './_components/cart-drawer/cart-footer';
import { CartLine } from './_components/cart-drawer/cart-line';
import { useCartDrawer } from './_components/cart-drawer/use-cart-drawer';
import {
  BOTTOM_SHEET_PLACEMENT,
  bottomSheetClassNames,
} from '@/lib/bottom-sheet';

type CartDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
};

// Récapitulatif du panier (liste + total). Les infos de retrait se saisissent
// sur /carte/commande, plus confortable sur mobile qu'un step imbriqué.
function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const cart = useCartDrawer(isOpen, onClose);
  const { items, duplicateItem, duplicateProduct } = cart;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        // Bottom sheet mobile, dialogue centré desktop (lib/bottom-sheet.ts).
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
                {items.map((item) => (
                  <CartLine key={item.cartId} item={item} cart={cart} />
                ))}
              </div>
            )}

            {items.length > 0 && <CartUpsell products={cart.upsellProducts} />}
          </ModalBody>

          {items.length > 0 && <CartFooter cart={cart} />}
        </ModalContent>
      </Modal>

      {duplicateProduct && (
        <SupplementModal
          product={duplicateProduct}
          isOpen={duplicateItem !== null}
          onClose={() => cart.setDuplicateItem(null)}
          initialSupplements={duplicateItem?.supplements ?? []}
          editToken={duplicateItem?.cartId}
        />
      )}
    </>
  );
}

export default CartDrawer;
