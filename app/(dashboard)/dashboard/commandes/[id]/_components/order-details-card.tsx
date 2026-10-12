import type { OrderType } from '@/generated/prisma/client';
import { PaymentMethodBadge } from '@/components/payment-method-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatAbidjanDateTime } from '@/lib/timezone';
import { EditOrderDetails } from '../edit-order-details';
import {
  formatPickupTime,
  ORDER_TYPE_LABELS,
  type OrderDetail,
} from './helpers';

export function OrderDetailsCard({
  order,
  isAdmin,
}: {
  order: OrderDetail;
  isAdmin: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span>Détails</span>
          {isAdmin && (
            <EditOrderDetails
              orderId={order.id}
              initialOrderType={order.orderType as OrderType}
              initialPickupTime={order.pickupTime?.toISOString() ?? null}
              initialPaymentMode={order.paymentMode}
              initialNote={order.note}
              isPaid={order.isPaid}
            />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">Commandée le</span>
          <span className="font-medium">
            {formatAbidjanDateTime(order.createdAt)}
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">Type de commande</span>
          <span className="font-medium">
            {ORDER_TYPE_LABELS[order.orderType as OrderType]}
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">Créneau de retrait</span>
          <span className="font-medium">
            {formatPickupTime(order.pickupTime)}
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">Moyen de paiement</span>
          {order.paymentMode ? (
            <PaymentMethodBadge
              mode={order.paymentMode}
              className="font-medium"
            />
          ) : order.isPaid ? (
            <span className="flex flex-wrap items-center justify-end gap-x-1.5 gap-y-1 font-medium">
              <span className="text-muted-foreground">Fractionné —</span>
              {order.payments.map((p, i) => (
                <span key={i} className="inline-flex items-center gap-1">
                  <PaymentMethodBadge mode={p.mode} />
                  <span>
                    {new Intl.NumberFormat('fr-FR').format(p.amount)} F
                  </span>
                  {i < order.payments.length - 1 && <span>+</span>}
                </span>
              ))}
            </span>
          ) : (
            <span className="font-medium">—</span>
          )}
        </div>
        <div className="space-y-1">
          <span className="text-muted-foreground">Note</span>
          <p className="font-medium whitespace-pre-wrap">
            {order.note?.trim() ? order.note : '—'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
