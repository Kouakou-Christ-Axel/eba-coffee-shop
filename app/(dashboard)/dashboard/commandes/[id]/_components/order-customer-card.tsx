import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AssociateCustomer } from '../../../_components/associate-customer';
import type { OrderDetail } from './helpers';

export function OrderCustomerCard({
  order,
  canCash,
}: {
  order: OrderDetail;
  canCash: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span>Client</span>
          {canCash && (
            <AssociateCustomer
              orderId={order.id}
              currentCustomerId={order.customerId}
              currentName={order.customerName}
              currentPhone={order.customerPhone}
            />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="font-medium">{order.customerName ?? 'Client anonyme'}</p>
        <p className="text-muted-foreground">{order.customerPhone ?? '—'}</p>
        {order.customerId && (
          <Link
            href={`/dashboard/clients/${order.customerId}`}
            className="inline-block pt-1 text-sm text-primary underline-offset-2 hover:underline"
          >
            Voir la fiche client →
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
