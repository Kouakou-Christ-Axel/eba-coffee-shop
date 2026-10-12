import { Bot } from 'lucide-react';
import { BackButton } from '@/components/(dashboard)/back-button';
import { Badge } from '@/components/ui/badge';
import { formatAbidjanDateTime } from '@/lib/timezone';
import { EncaisserButton } from '../../../_components/encaisser-button';
import { AcompteButton } from '../../acompte-button';
import { ExpressCompleteButton } from '../../express-complete-button';
import {
  formatPickupTime,
  STATUS_LABELS,
  STATUS_VARIANTS,
  type OrderDetail,
} from './helpers';

export function OrderHeader({
  order,
  canCash,
}: {
  order: OrderDetail;
  canCash: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <BackButton
          fallbackHref="/dashboard/commandes"
          className="-ml-3 mb-2"
        />
        <h1 className="font-mono text-2xl font-bold">
          #{String(order.dailyNumber).padStart(3, '0')}
        </h1>
        <p className="font-mono text-xs text-muted-foreground">
          {order.reference}
        </p>
        <p className="mt-1 text-muted-foreground">
          Commandée le {formatAbidjanDateTime(order.createdAt)}
        </p>
        <p className="text-muted-foreground">
          {formatPickupTime(order.pickupTime)}
        </p>
      </div>
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <Badge variant={STATUS_VARIANTS[order.status]}>
          {STATUS_LABELS[order.status]}
        </Badge>
        <Badge
          variant={order.isPaid ? 'default' : 'secondary'}
          className="inline-flex items-center gap-1"
        >
          {order.isPaid ? 'Payée' : 'Non payée'}
          {order.isPaid && order.paymentAutoValidatedByAi && (
            <span title="Encaissement automatique (IA)">
              <Bot className="h-3 w-3" aria-hidden="true" />
            </span>
          )}
        </Badge>
        {order.status === 'CANCELLED' && order.isPaid && (
          <Badge variant="destructive">Remboursée</Badge>
        )}
        {order.depositRequired != null && !order.isPaid && (
          <Badge variant="outline" className="border-amber-400 text-amber-800">
            Acompte{' '}
            {new Intl.NumberFormat('fr-FR').format(order.depositPaid ?? 0)}/
            {new Intl.NumberFormat('fr-FR').format(order.depositRequired)} F
          </Badge>
        )}
        {canCash &&
          order.depositRequired != null &&
          (order.depositPaid ?? 0) < order.depositRequired &&
          !order.isPaid &&
          order.status !== 'CANCELLED' && (
            <AcompteButton
              orderId={order.id}
              orderRef={`#${String(order.dailyNumber).padStart(3, '0')}`}
              amount={order.depositRequired - (order.depositPaid ?? 0)}
            />
          )}
        {canCash && !order.isPaid && order.status !== 'CANCELLED' && (
          <EncaisserButton
            orderId={order.id}
            orderRef={`#${String(order.dailyNumber).padStart(3, '0')}`}
            amount={order.total - (order.depositPaid ?? 0)}
          />
        )}
        {canCash &&
          order.status !== 'CANCELLED' &&
          order.status !== 'COMPLETED' && (
            <ExpressCompleteButton
              orderId={order.id}
              orderRef={`#${String(order.dailyNumber).padStart(3, '0')}`}
              amount={order.total - (order.depositPaid ?? 0)}
              isPaid={order.isPaid}
              pickupTime={order.pickupTime}
              stockReserved={order.stockReservedAt !== null}
            />
          )}
      </div>
    </div>
  );
}
