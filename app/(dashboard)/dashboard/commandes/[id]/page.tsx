import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getOrder } from '@/lib/orders';
import { getMenu } from '@/lib/menu';
import { getCurrentSession } from '@/lib/auth-helpers';
import { formatAbidjanDateTime } from '@/lib/timezone';
import type { CartItem } from '@/lib/cart-store';
import { getItemGross, getItemNet } from '@/lib/orders/totals';
import { formatSupplementLabel } from '@/lib/orders/format';
import type {
  OrderStatus,
  OrderType,
  PaymentMode,
} from '@/generated/prisma/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { StatusButtons } from './status-buttons';
import { EditOrderItems } from './edit-order-items';
import { AssociateCustomer } from './associate-customer';
import { EditOrderDetails } from './edit-order-details';
import { EncaisserButton } from '../encaisser-button';
import { ExpressCompleteButton } from '../express-complete-button';
import { CopyRecapButton } from '../../_components/copy-recap-button';
import { BackButton } from '@/components/(dashboard)/back-button';

const STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: 'Nouvelle',
  PREPARING: 'En cours',
  READY: 'Prête',
  COMPLETED: 'Récupérée',
  CANCELLED: 'Annulée',
};

const STATUS_VARIANTS: Record<
  OrderStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  NEW: 'secondary',
  PREPARING: 'default',
  READY: 'default',
  COMPLETED: 'outline',
  CANCELLED: 'destructive',
};

const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  TAKEAWAY: 'À emporter',
  DINE_IN: 'Sur place',
  DELIVERY: 'Livraison',
};

const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  CASH: 'Espèces',
  WAVE: 'Wave',
  OTHER: 'Autre',
};

function formatPickupTime(date: Date | null): string {
  // Toujours en heure Abidjan : déterministe quel que soit le fuseau du serveur.
  if (!date) return 'Sans créneau (walk-in)';
  return formatAbidjanDateTime(date);
}

export default async function CommandeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Les 3 lectures sont indépendantes (menu et session ne dépendent pas de
  // `order`) : parallélisées pour éviter une waterfall à 3 allers-retours DB.
  const [order, menu, session] = await Promise.all([
    getOrder(id),
    getMenu(),
    // Édition des métadonnées (paiement, type, créneau, note) réservée à l'ADMIN.
    getCurrentSession(),
  ]);

  if (!order) {
    notFound();
  }

  const items = order.items as CartItem[];
  const isAdmin = session?.user.role === 'ADMIN';

  return (
    <div className="space-y-6">
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
            {formatPickupTime(order.pickupTime)}
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <Badge variant={STATUS_VARIANTS[order.status]}>
            {STATUS_LABELS[order.status]}
          </Badge>
          <Badge variant={order.isPaid ? 'default' : 'secondary'}>
            {order.isPaid ? 'Payée' : 'Non payée'}
          </Badge>
          {order.status === 'CANCELLED' && order.isPaid && (
            <Badge variant="destructive">Remboursée</Badge>
          )}
          {!order.isPaid && order.status !== 'CANCELLED' && (
            <EncaisserButton
              orderId={order.id}
              orderRef={`#${String(order.dailyNumber).padStart(3, '0')}`}
              amount={order.total}
            />
          )}
          {order.status !== 'CANCELLED' && order.status !== 'COMPLETED' && (
            <ExpressCompleteButton
              orderId={order.id}
              orderRef={`#${String(order.dailyNumber).padStart(3, '0')}`}
              amount={order.total}
              isPaid={order.isPaid}
              currentPaymentMode={order.paymentMode}
            />
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            <span>Client</span>
            <AssociateCustomer
              orderId={order.id}
              currentCustomerId={order.customerId}
              currentName={order.customerName}
              currentPhone={order.customerPhone}
            />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className="font-medium">
            {order.customerName ?? 'Client anonyme'}
          </p>
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
            <span className="font-medium">
              {order.paymentMode ? PAYMENT_MODE_LABELS[order.paymentMode] : '—'}
            </span>
          </div>
          <div className="space-y-1">
            <span className="text-muted-foreground">Note</span>
            <p className="font-medium whitespace-pre-wrap">
              {order.note?.trim() ? order.note : '—'}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            <span>Articles</span>
            <div className="flex flex-wrap items-center gap-2">
              <CopyRecapButton
                customerName={order.customerName}
                dailyNumber={order.dailyNumber}
                amount={order.total}
                items={items}
                size="sm"
                className="w-auto"
              />
              <EditOrderItems
                orderId={order.id}
                initialItems={items}
                menu={menu}
                status={order.status as OrderStatus}
              />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4">
            {items.map((item) => {
              const gross = getItemGross(item);
              const net = getItemNet(item);
              const discounted = gross !== net;
              const unitCost =
                (item.coutMatiere ?? 0) + (item.coutEmballage ?? 0);
              const lineCost = unitCost * item.quantity;
              const hasCost = unitCost > 0;
              const margin = net - lineCost;
              return (
                <li key={item.cartId}>
                  <div className="flex justify-between gap-3">
                    <span className="flex items-center gap-1.5 font-medium">
                      <span>
                        {item.productName} x{item.quantity}
                      </span>
                      {item.addedLater && (
                        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                          Ajout
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-right">
                      {discounted && (
                        <span className="mr-1 text-sm text-muted-foreground line-through">
                          {new Intl.NumberFormat('fr-FR').format(gross)}
                        </span>
                      )}
                      {new Intl.NumberFormat('fr-FR').format(net)} FCFA
                    </span>
                  </div>
                  {item.supplements.length > 0 && (
                    <ul className="mt-1 space-y-0.5 pl-4 text-sm text-muted-foreground">
                      {item.supplements.map((sup, i) => (
                        <li key={i}>
                          {sup.groupName} : {formatSupplementLabel(sup)}
                          {sup.price > 0
                            ? ` (+${sup.price * (sup.quantity ?? 1)} FCFA)`
                            : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                  {discounted && (
                    <p className="mt-0.5 text-sm font-medium text-green-700 dark:text-green-400">
                      Remise : -
                      {new Intl.NumberFormat('fr-FR').format(gross - net)} FCFA
                      {item.discountReason ? ` — ${item.discountReason}` : ''}
                    </p>
                  )}
                  {hasCost && (
                    <p className="mt-0.5 pl-0 text-xs text-muted-foreground">
                      Coût : {new Intl.NumberFormat('fr-FR').format(lineCost)}{' '}
                      FCFA
                      {' · '}Marge :{' '}
                      {new Intl.NumberFormat('fr-FR').format(margin)} FCFA
                      {net > 0 ? ` (${Math.round((margin / net) * 100)}%)` : ''}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          <Separator className="my-4" />
          {(() => {
            const totalCost = items.reduce((sum, item) => {
              const unitCost =
                (item.coutMatiere ?? 0) + (item.coutEmballage ?? 0);
              return sum + unitCost * item.quantity;
            }, 0);
            const hasAnyCost = totalCost > 0;
            const grossTotal = items.reduce(
              (sum, item) => sum + getItemGross(item),
              0
            );
            const totalDiscount = grossTotal - order.total;
            return (
              <>
                {totalDiscount > 0 && (
                  <>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Sous-total</span>
                      <span>
                        {new Intl.NumberFormat('fr-FR').format(grossTotal)} FCFA
                      </span>
                    </div>
                    <div className="mb-1 flex justify-between text-sm font-medium text-green-700 dark:text-green-400">
                      <span>Remise</span>
                      <span>
                        -{new Intl.NumberFormat('fr-FR').format(totalDiscount)}{' '}
                        FCFA
                      </span>
                    </div>
                  </>
                )}
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <span>
                    {new Intl.NumberFormat('fr-FR').format(order.total)} FCFA
                  </span>
                </div>
                {hasAnyCost && (
                  <div className="mt-1 flex justify-between text-sm text-muted-foreground">
                    <span>Marge totale</span>
                    <span>
                      {new Intl.NumberFormat('fr-FR').format(
                        order.total - totalCost
                      )}{' '}
                      FCFA (
                      {Math.round(
                        ((order.total - totalCost) / order.total) * 100
                      )}
                      %)
                    </span>
                  </div>
                )}
              </>
            );
          })()}
        </CardContent>
      </Card>

      <StatusButtons
        orderId={order.id}
        currentStatus={order.status as OrderStatus}
      />
    </div>
  );
}
