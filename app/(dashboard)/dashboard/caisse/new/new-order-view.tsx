'use client';

import { useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { MenuCategory } from '@/config/menu';
import type { CartItem } from '@/lib/cart-store';
import { useNewOrder } from '@/lib/hooks/use-new-order';
import { useLiveMenu } from '@/lib/hooks/use-live-menu';
import { ProductCatalog } from './product-catalog';
import { CartSummary } from './cart-summary';
import { SupplementPicker } from './supplement-picker';
import { CustomerInfoStep } from './_components/customer-info-step';
import { OrderBottomBar } from './_components/order-bottom-bar';

export function NewOrderView({ menu: initialMenu }: { menu: MenuCategory[] }) {
  const o = useNewOrder();
  // Menu « live » : reflète en direct une réappro (goût recrédité) faite ici ou
  // ailleurs, sans recharger la page.
  const { menu, applyRestock } = useLiveMenu(initialMenu);

  // Produits ayant des groupes de suppléments configurés : sert à
  // n'afficher « Dupliquer avec des suppléments différents » (CartSummary)
  // que là où ça a un sens.
  const productsWithOptions = useMemo(() => {
    const set = new Set<string>();
    for (const cat of menu)
      for (const p of cat.products)
        if ((p.supplements?.length ?? 0) > 0) set.add(p.id);
    return set;
  }, [menu]);

  function handleDuplicate(item: CartItem) {
    const product = menu
      .flatMap((cat) => cat.products)
      .find((p) => p.id === item.productId);
    if (!product) return;
    o.duplicateLineWithOptions(product, item.cartId);
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] min-w-0 flex-col gap-4 pb-24">
      <header className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={o.goBackOrCancel}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-lg font-semibold">
          {o.step === 'catalog' ? 'Nouvelle commande' : 'Récapitulatif'}
        </h1>
      </header>

      {o.step === 'catalog' ? (
        /* Tablette (md+) : le panier reste visible PENDANT la sélection, pour
           corriger une erreur sans aller-retour vers le récapitulatif.
           Téléphone : flux en deux étapes inchangé, le panier est atteint par
           la barre du bas. */
        <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] [&>*]:min-w-0">
          <ProductCatalog
            menu={menu}
            onProductTap={o.handleProductTap}
            onOpenOptions={o.openPicker}
          />
          <aside className="hidden md:block">
            <div className="sticky top-4">
              <CartSummary
                items={o.items}
                onQuantityChange={o.handleQuantityChange}
                onRemove={o.handleRemove}
                onDiscountChange={o.handleDiscountChange}
                onDuplicate={handleDuplicate}
                productsWithOptions={productsWithOptions}
                loyaltyCard={o.loyaltyCard}
                loyaltyRewardId={o.loyaltyRewardId}
                onLoyaltyRewardChange={o.setLoyaltyRewardId}
              />
            </div>
          </aside>
        </div>
      ) : (
        <div className="grid min-w-0 gap-3 md:grid-cols-2 md:gap-4 [&>*]:min-w-0">
          <CartSummary
            items={o.items}
            onQuantityChange={o.handleQuantityChange}
            onRemove={o.handleRemove}
            onDiscountChange={o.handleDiscountChange}
            onDuplicate={handleDuplicate}
            productsWithOptions={productsWithOptions}
            loyaltyCard={o.loyaltyCard}
            loyaltyRewardId={o.loyaltyRewardId}
            onLoyaltyRewardChange={o.setLoyaltyRewardId}
          />
          <CustomerInfoStep
            customerName={o.customerName}
            customerPhone={o.customerPhone}
            orderType={o.orderType}
            note={o.note}
            pickupTime={o.pickupTime}
            orderDate={o.orderDate}
            submitError={o.submitError}
            onCustomerNameChange={o.setCustomerName}
            onCustomerPhoneChange={o.setCustomerPhone}
            onOrderTypeChange={o.setOrderType}
            onNoteChange={o.setNote}
            onPickupTimeChange={o.setPickupTime}
            onOrderDateChange={o.setOrderDate}
          />
        </div>
      )}

      <OrderBottomBar
        step={o.step}
        itemsCount={o.items.length}
        totalItems={o.totalItems}
        totalPrice={o.totalDue}
        isSubmitting={o.isSubmitting}
        onReview={() => o.setStep('review')}
        onSubmit={o.submit}
      />

      <SupplementPicker
        product={o.pickerProduct}
        isOpen={o.isPickerOpen}
        onClose={o.closePicker}
        onAdd={({ product, supplements }) => o.addToCart(product, supplements)}
        initialSupplements={o.pickerInitialSupplements}
        editToken={o.pickerCartId ?? undefined}
        onRestocked={(groupName, optionName, stock) => {
          if (!o.pickerProduct) return;
          applyRestock(
            {
              target: 'option',
              productId: o.pickerProduct.id,
              groupName,
              optionName,
            },
            stock
          );
        }}
      />
    </div>
  );
}
