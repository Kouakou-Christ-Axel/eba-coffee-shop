import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getOrder } from '@/lib/orders';
import type { CartItem } from '@/lib/cart-store';
import type { OrderStatus } from '@/generated/prisma';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { StatusButtons } from './status-buttons';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  READY: 'Prête',
  PICKED_UP: 'Récupérée',
  CANCELLED: 'Annulée',
};

const STATUS_VARIANTS: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  PENDING: 'secondary',
  CONFIRMED: 'default',
  READY: 'default',
  PICKED_UP: 'outline',
  CANCELLED: 'destructive',
};

function formatPickupTime(date: Date): string {
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
          <h1 className="font-mono text-2xl font-bold">{order.reference}</h1>
          <p className="text-muted-foreground">
            {formatPickupTime(order.pickupTime)}
          </p>
        </div>
        <Badge variant={STATUS_VARIANTS[order.status]}>
          {STATUS_LABELS[order.status]}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Client</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className="font-medium">{order.customerName}</p>
          <p className="text-muted-foreground">{order.customerPhone}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Articles</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4">
            {items.map((item) => (
              <li key={item.cartId}>
                <div className="flex justify-between">
                  <span className="font-medium">
                    {item.productName} x{item.quantity}
                  </span>
                  <span>
                    {new Intl.NumberFormat('fr-FR').format(
                      (item.basePrice +
                        item.supplements.reduce((s, sup) => s + sup.price, 0)) *
                        item.quantity
                    )}{' '}
                    FCFA
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
              </li>
            ))}
          </ul>
          <Separator className="my-4" />
          <div className="flex justify-between font-bold">
            <span>Total</span>
            <span>
              {new Intl.NumberFormat('fr-FR').format(order.total)} FCFA
            </span>
          </div>
        </CardContent>
      </Card>

      <StatusButtons
        orderId={order.id}
        currentStatus={order.status as OrderStatus}
      />
    </div>
  );
}
