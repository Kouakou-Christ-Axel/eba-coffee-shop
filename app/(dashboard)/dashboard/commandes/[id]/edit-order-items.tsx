'use client';

import { useState } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody } from '@heroui/react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CartItem } from '@/lib/cart-store';
import type { MenuCategory } from '@/config/menu';
import type { OrderStatus } from '@/generated/prisma/client';
import { OrderItemsEditor } from '../../_components/order-items-editor';

type Props = {
  orderId: string;
  initialItems: CartItem[];
  menu: MenuCategory[];
  status: OrderStatus;
};

export function EditOrderItems({ orderId, initialItems, menu, status }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  const isLocked = status === 'COMPLETED' || status === 'CANCELLED';

  if (isLocked) return null;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="gap-1.5"
      >
        <Pencil className="size-3.5" />
        Modifier les articles
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        placement="center"
        size="lg"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader>Commande</ModalHeader>
          <ModalBody className="pb-6">
            <OrderItemsEditor
              orderId={orderId}
              initialItems={initialItems}
              menu={menu}
              onClose={() => setIsOpen(false)}
            />
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
