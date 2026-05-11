import { listOrders } from '@/lib/orders';
import type { OrderStatus } from '@/generated/prisma';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { StatusTabs } from './status-tabs';

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
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(date)
    .replace(':', 'h');
}

export default async function CommandesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1));
  const VALID_STATUSES = new Set([
    'PENDING',
    'CONFIRMED',
    'READY',
    'PICKED_UP',
    'CANCELLED',
  ]);
  const rawStatus = params.status;
  const status = (
    rawStatus && VALID_STATUSES.has(rawStatus) ? rawStatus : undefined
  ) as OrderStatus | undefined;

  const { orders, total, pageSize } = await listOrders({ page, status });
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Commandes</h1>
      <StatusTabs activeStatus={status} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Référence</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Téléphone</TableHead>
            <TableHead>Créneau</TableHead>
            <TableHead>Articles</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id}>
              <TableCell className="font-mono text-sm">
                {order.reference}
              </TableCell>
              <TableCell>{order.customerName}</TableCell>
              <TableCell>{order.customerPhone}</TableCell>
              <TableCell>{formatPickupTime(order.pickupTime)}</TableCell>
              <TableCell>{(order.items as unknown[]).length}</TableCell>
              <TableCell>
                {new Intl.NumberFormat('fr-FR').format(order.total)} FCFA
              </TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANTS[order.status]}>
                  {STATUS_LABELS[order.status]}
                </Badge>
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/dashboard/commandes/${order.id}`}>Voir</Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {totalPages > 1 && (
        <div className="flex items-center gap-3">
          {page > 1 && (
            <Button variant="outline" size="sm" asChild>
              <Link
                href={`?page=${page - 1}${status ? `&status=${status}` : ''}`}
              >
                Précédent
              </Link>
            </Button>
          )}
          <span className="text-sm text-muted-foreground">
            Page {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Button variant="outline" size="sm" asChild>
              <Link
                href={`?page=${page + 1}${status ? `&status=${status}` : ''}`}
              >
                Suivant
              </Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
