'use client';

import { Modal, ModalContent, ModalHeader, ModalBody } from '@heroui/react';
import { OrderItemsEditor } from '../../../_components/order-items-editor';
import { PaymentModal } from '../../payment-modal';
import { EditFulfillmentModal } from '../../edit-fulfillment-modal';
import { EditCustomerModal } from '../../edit-customer-modal';
import { EditLoyaltyModal } from '../../edit-loyalty-modal';
import type { CashierOrder } from '@/lib/cashier-queue';
import type { MenuCategory } from '@/config/menu';
import type { OrderActions } from './use-order-actions';
import type { OrderView } from './use-order-view';

export function ActionModals({
  order,
  view,
  actions,
  menu,
}: {
  order: CashierOrder;
  view: OrderView;
  actions: OrderActions;
  menu: MenuCategory[];
}) {
  const { depositRemaining, orderRef } = view;
  const {
    isPaymentOpen,
    setIsPaymentOpen,
    paymentError,
    setPaymentError,
    isDepositOpen,
    setIsDepositOpen,
    depositError,
    setDepositError,
    isPending,
    isEditOpen,
    setIsEditOpen,
    isEditFulfillmentOpen,
    setIsEditFulfillmentOpen,
    isEditCustomerOpen,
    setIsEditCustomerOpen,
    isEditLoyaltyOpen,
    setIsEditLoyaltyOpen,
    confirmDialog,
    shortageDialog,
    handlePaymentConfirm,
    handleDepositConfirm,
  } = actions;
  return (
    <>
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        placement="center"
        size="lg"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader>Commande {orderRef}</ModalHeader>
          <ModalBody className="pb-6">
            <OrderItemsEditor
              orderId={order.id}
              initialItems={order.items}
              menu={menu}
              stockReserved={order.stockReservedAt !== null}
              onClose={() => setIsEditOpen(false)}
            />
          </ModalBody>
        </ModalContent>
      </Modal>

      <PaymentModal
        isOpen={isPaymentOpen}
        onClose={() => {
          setIsPaymentOpen(false);
          setPaymentError(null);
        }}
        orderRef={orderRef}
        amount={order.total - (order.depositPaid ?? 0)}
        isSubmitting={isPending}
        onConfirm={handlePaymentConfirm}
        error={paymentError}
      />

      <PaymentModal
        isOpen={isDepositOpen}
        onClose={() => {
          setIsDepositOpen(false);
          setDepositError(null);
        }}
        orderRef={orderRef}
        amount={depositRemaining}
        isSubmitting={isPending}
        onConfirm={handleDepositConfirm}
        error={depositError}
      />

      <EditFulfillmentModal
        isOpen={isEditFulfillmentOpen}
        onClose={() => setIsEditFulfillmentOpen(false)}
        order={order}
      />

      <EditCustomerModal
        isOpen={isEditCustomerOpen}
        onClose={() => setIsEditCustomerOpen(false)}
        order={order}
      />

      <EditLoyaltyModal
        isOpen={isEditLoyaltyOpen}
        onClose={() => setIsEditLoyaltyOpen(false)}
        order={order}
      />

      {confirmDialog}
      {shortageDialog}
    </>
  );
}
