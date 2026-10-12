'use client';

import { Modal, ModalContent, ModalHeader, ModalBody } from '@heroui/react';
import type { MenuCategory } from '@/config/menu';
import type { PreparationOrder } from '@/lib/preparation-queue';
import { OrderItemsEditor } from '../../../_components/order-items-editor';

export function OrderEditModal({
  order,
  menu,
  isOpen,
  onClose,
}: {
  order: PreparationOrder;
  menu: MenuCategory[];
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={() => onClose()}
      placement="center"
      size="lg"
      scrollBehavior="inside"
    >
      <ModalContent>
        <ModalHeader>
          Commande #{String(order.dailyNumber).padStart(3, '0')}
        </ModalHeader>
        <ModalBody className="pb-6">
          <OrderItemsEditor
            orderId={order.id}
            initialItems={order.items}
            menu={menu}
            stockReserved={order.stockReservedAt !== null}
            onClose={() => onClose()}
          />
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
