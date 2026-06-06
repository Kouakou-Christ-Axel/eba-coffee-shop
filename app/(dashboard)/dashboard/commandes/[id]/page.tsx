import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getOrder } from '@/lib/orders';
import type { CartItem } from '@/lib/cart-store';
import type { OrderStatus } from '@/generated/prisma/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { StatusButtons } from './status-buttons';
import { EditOrderItems } from './edit-order-items';

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

function formatPickupTime(date: Date | null): string {
  if (!date) return 'Sans créneau (walk-in)';
  const dayMonth = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
  const time = new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(date)
    .replace(':', 'h');
  return `${dayMonth} · ${time}`;
}

export default async function CommandeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getOrder(id);

  if (!order) {
    notFound();
  }

  const items = order.items as CartItem[];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-3 mb-2">
            <Link href="/dashboard/commandes">← Retour</Link>
          </Button>
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
        <div className="flex flex-col items-end gap-2">
          <Badge variant={STATUS_VARIANTS[order.status]}>
            {STATUS_LABELS[order.status]}
          </Badge>
          <Badge variant={order.isPaid ? 'default' : 'secondary'}>
            {order.isPaid ? 'Payée' : 'Non payée'}
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Client</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className="font-medium">
            {order.customerName ?? 'Client anonyme'}
          </p>
          <p className="text-muted-foreground">{order.customerPhone ?? '—'}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Articles</span>
            <EditOrderItems
              orderId={order.id}
              initialItems={items}
              status={order.status as OrderStatus}
            />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4">
            {items.map((item) => {
              const unitSell = item.basePrice + item.supplements.reduce((s, sup) => s + sup.price, 0);
              const unitCost = (item.coutMatiere ?? 0) + (item.coutEmballage ?? 0);
              const lineTotal = unitSell * item.quantity;
              const hasCost = unitCost > 0;
              return (
                <li key={item.cartId}>
                  <div className="flex justify-between">
                    <span className="font-medium">
                      {item.productName} x{item.quantity}
                    </span>
                    <span>
                      {new Intl.NumberFormat('fr-FR').format(lineTotal)}{' '}FCFA
                    </span>
                  </div>
                  {item.supplements.length > 0 && (
                    <ul className="mt-1 space-y-0.5 pl-4 text-sm text-muted-foreground">
                      {item.supplements.map((sup, i) => (
                        <li key={i}>
                          {sup.groupName} : {sup.optionName}
                          {sup.price > 0 ? ` (+${sup.price} FCFA)` : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                  {hasCost && (
                    <p className="mt-0.5 pl-0 text-xs text-muted-foreground">
                      Coût : {new Intl.NumberFormat('fr-FR').format(unitCost * item.quantity)} FCFA
                      {' · '}Marge : {new Intl.NumberFormat('fr-FR').format((unitSell - unitCost) * item.quantity)} FCFA
                      {' '}({Math.round(((unitSell - unitCost) / unitSell) * 100)}%)
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          <Separator className="my-4" />
          {(() => {
            const totalCost = items.reduce((sum, item) => {
              const unitCost = (item.coutMatiere ?? 0) + (item.coutEmballage ?? 0);
              return sum + unitCost * item.quantity;
            }, 0);
            const hasAnyCost = totalCost > 0;
            return (
              <>
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <span>{new Intl.NumberFormat('fr-FR').format(order.total)} FCFA</span>
                </div>
                {hasAnyCost && (
                  <div className="mt-1 flex justify-between text-sm text-muted-foreground">
                    <span>Marge totale</span>
                    <span>
                      {new Intl.NumberFormat('fr-FR').format(order.total - totalCost)} FCFA
                      {' '}({Math.round(((order.total - totalCost) / order.total) * 100)}%)
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
