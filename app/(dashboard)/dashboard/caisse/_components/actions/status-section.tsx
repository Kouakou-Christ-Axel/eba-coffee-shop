'use client';

import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CashierOrder } from '@/lib/cashier-queue';
import type { OrderView } from './use-order-view';

export function StatusSection({
  order,
  view,
}: {
  order: CashierOrder;
  view: OrderView;
}) {
  const { readyLink } = view;
  return (
    <>
      {/* Commande prête : prévenir le client en un tap (WhatsApp) */}
      {order.status === 'READY' && readyLink && (
        <Button asChild variant="outline" size="lg" className="w-full">
          <a href={readyLink} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="mr-1.5 h-4 w-4" />
            Prévenir&nbsp;: c&apos;est prêt
          </a>
        </Button>
      )}
    </>
  );
}
