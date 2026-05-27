'use client';

import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { MenuCategory } from '@/config/menu';
import { useNewOrder } from '@/lib/hooks/use-new-order';
import { ProductCatalog } from './product-catalog';
import { CartSummary } from './cart-summary';
import { SupplementPicker } from './supplement-picker';
import { CustomerInfoStep } from './_components/customer-info-step';
import { OrderBottomBar } from './_components/order-bottom-bar';

export function NewOrderView({ menu }: { menu: MenuCategory[] }) {
  const o = useNewOrder();

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col gap-4 pb-24">
      <header className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={o.goBackOrCancel}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-lg font-semibold">
          {o.step === 'catalog' ? 'Nouvelle commande' : 'Récapitulatif'}
        </h1>
      </header>

      {o.step === 'catalog' ? (
        <ProductCatalog menu={menu} onProductTap={o.handleProductTap} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 md:gap-4">
          <CartSummary
            items={o.items}
            onQuantityChange={o.handleQuantityChange}
            onRemove={o.handleRemove}
          />
          <CustomerInfoStep
            customerName={o.customerName}
            customerPhone={o.customerPhone}
            orderType={o.orderType}
            note={o.note}
            submitError={o.submitError}
            onCustomerNameChange={o.setCustomerName}
            onCustomerPhoneChange={o.setCustomerPhone}
            onOrderTypeChange={o.setOrderType}
            onNoteChange={o.setNote}
          />
        </div>
      )}

      <OrderBottomBar
        step={o.step}
        itemsCount={o.items.length}
        totalItems={o.totalItems}
        totalPrice={o.totalPrice}
        isSubmitting={o.isSubmitting}
        onReview={() => o.setStep('review')}
        onSubmit={o.submit}
      />

      <SupplementPicker
        product={o.pickerProduct}
        isOpen={o.isPickerOpen}
        onClose={o.closePicker}
        onAdd={({ product, supplements }) => o.addToCart(product, supplements)}
      />
    </div>
  );
}
