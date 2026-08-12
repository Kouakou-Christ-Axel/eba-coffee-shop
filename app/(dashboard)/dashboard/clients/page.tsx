import Link from 'next/link';
import { Handshake } from 'lucide-react';
import { requireRoleOrAnalyst } from '@/lib/auth-helpers';
import { listCustomers } from '@/lib/customers';
import { formatPhoneForDisplay } from '@/lib/phone';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CustomerSearch } from './customer-search';
import { CustomerFormSheet } from './customer-form';
import { Pagination } from './pagination';

export const dynamic = 'force-dynamic';

const priceFmt = new Intl.NumberFormat('fr-FR');
const dateFmt = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  await requireRoleOrAnalyst(['ADMIN']);
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1));
  const search = params.search?.trim() || undefined;

  const { customers, total, pageSize } = await listCustomers({ search, page });
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-sm text-muted-foreground">
            {total} client{total > 1 ? 's' : ''} identifié
            {total > 1 ? 's' : ''} par téléphone.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CustomerSearch initial={search ?? ''} />
          <CustomerFormSheet mode="create" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead>Confiance</TableHead>
              <TableHead>Commandes</TableHead>
              <TableHead>Total dépensé</TableHead>
              <TableHead>Dernière commande</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/dashboard/clients/${c.id}`}
                    className="hover:underline"
                  >
                    {c.name ?? '—'}
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {formatPhoneForDisplay(c.phone)}
                </TableCell>
                <TableCell>
                  {c.isTrusted ? (
                    <Badge
                      className="bg-blue-600"
                      title={c.trustedNote ?? undefined}
                    >
                      <Handshake className="h-3 w-3" aria-hidden="true" />
                      Confiance
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="tabular-nums">
                  {c.stats.ordersCount}
                </TableCell>
                <TableCell className="tabular-nums">
                  {priceFmt.format(c.stats.totalSpent)} F
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {c.stats.lastOrderAt
                    ? dateFmt.format(c.stats.lastOrderAt)
                    : '—'}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/dashboard/clients/${c.id}`}>Voir</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {customers.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-8 text-center text-muted-foreground"
                >
                  Aucun client pour cette recherche.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} />}
    </div>
  );
}
