import { Button, ModalFooter } from '@heroui/react';
import { priceFormatter } from '@/config/menu';
import { PrecommandeBanner } from '../precommande-banner';
import type { CartDrawerState } from './use-cart-drawer';

export function CartFooter({ cart }: { cart: CartDrawerState }) {
  const { goneCount, soldOutCount } = cart;

  return (
    <ModalFooter className="flex-col gap-3">
      {goneCount > 0 ? (
        <p className="w-full rounded-xl bg-danger-50 px-3 py-2 text-sm text-danger-700">
          {goneCount > 1
            ? 'Des articles ne sont plus disponibles : retire-les pour continuer.'
            : 'Un article n’est plus disponible : retire-le pour continuer.'}
        </p>
      ) : (
        soldOutCount > 0 && (
          <p className="w-full rounded-xl bg-warning-50 px-3 py-2 text-sm text-warning-700">
            {soldOutCount > 1
              ? 'Des articles viennent d’être épuisés : tu pourras les remplacer à l’étape suivante.'
              : 'Un article vient d’être épuisé : tu pourras le remplacer à l’étape suivante.'}
          </p>
        )
      )}
      {/* Statut global, informatif, sous les bandeaux d'erreur. */}
      {cart.precommande && <PrecommandeBanner className="w-full" />}
      <div className="flex w-full items-center justify-between">
        <span className="text-base font-semibold">Total</span>
        <span className="text-lg font-bold text-primary">
          {priceFormatter.format(cart.totalPrice)}&nbsp;F
        </span>
      </div>

      <Button
        color="primary"
        className="w-full"
        size="lg"
        onPress={cart.goToCheckout}
        isDisabled={goneCount > 0}
      >
        Passer la commande
      </Button>

      <button
        onClick={cart.clearAndClose}
        className="text-xs text-foreground/40 transition-colors hover:text-destructive"
      >
        Vider le panier
      </button>
    </ModalFooter>
  );
}
