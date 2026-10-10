'use client';

import type { CashierOrder } from '@/lib/cashier-queue';
import type { MenuCategory } from '@/config/menu';
import { ActionModals } from './_components/actions/action-modals';
import { ContactSection } from './_components/actions/contact-section';
import { EditSection } from './_components/actions/edit-section';
import { PaymentSection } from './_components/actions/payment-section';
import { SignalsSection } from './_components/actions/signals-section';
import { StatusSection } from './_components/actions/status-section';
import type { CaisseContactSettings } from './_components/actions/types';
import { useOrderActions } from './_components/actions/use-order-actions';
import { useOrderView } from './_components/actions/use-order-view';

export function OrderCardActions({
  order,
  menu,
  contactSettings,
}: {
  order: CashierOrder;
  menu: MenuCategory[];
  contactSettings: CaisseContactSettings;
}) {
  const view = useOrderView(order, contactSettings);
  const actions = useOrderActions(order, view);

  return (
    <>
      <div className="flex flex-col gap-2">
        <ContactSection
          order={order}
          view={view}
          contactSettings={contactSettings}
        />
        <SignalsSection order={order} view={view} actions={actions} />
        <PaymentSection order={order} view={view} actions={actions} />
        <StatusSection order={order} view={view} actions={actions} />
        <EditSection order={order} view={view} actions={actions} />
      </div>
      <ActionModals order={order} view={view} actions={actions} menu={menu} />
    </>
  );
}
