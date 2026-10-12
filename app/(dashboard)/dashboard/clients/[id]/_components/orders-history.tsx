import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { dateFmt, priceFmt, STATUS_LABELS, STATUS_VARIANTS } from './helpers';
import type { CustomerData } from './types';

export function OrdersHistory({ orders }: { orders: CustomerData['orders'] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Historique des commandes</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Référence</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="text-sm">
                  {dateFmt.format(o.createdAt)}
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {o.reference}
                </TableCell>
                <TableCell className="tabular-nums">
                  {priceFmt.format(o.total)} F
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANTS[o.status]}>
                    {STATUS_LABELS[o.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/dashboard/commandes/${o.id}`}>Voir</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {orders.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  Aucune commande.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
