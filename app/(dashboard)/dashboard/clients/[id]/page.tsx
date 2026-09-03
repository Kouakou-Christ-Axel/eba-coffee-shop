import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Handshake } from 'lucide-react';
import { requireRoleOrAnalyst, ROLE_GROUPS } from '@/lib/auth-helpers';
import { BackButton } from '@/components/(dashboard)/back-button';
import { getCustomer } from '@/lib/customers';
import { getLoyaltyCard } from '@/lib/loyalty';
import { formatPhoneForDisplay } from '@/lib/phone';
import type { OrderStatus } from '@/generated/prisma/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CustomerFormSheet } from '../customer-form';
import { MergeCustomerSheet } from '../merge-customer-form';
import { MissedOrderStampsSheet } from '../missed-order-stamps-form';
import { TrustedCustomerCard } from '../trusted-customer-card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export const dynamic = 'force-dynamic';

const priceFmt = new Intl.NumberFormat('fr-FR');
const dateFmt = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const dobFmt = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

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

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRoleOrAnalyst(['ADMIN']);
  // Le statut « client de confiance » est réservé à MANAGER_PLUS (l'action
  // serveur refuserait de toute façon) : on masque le contrôle aux rôles en
  // lecture seule plutôt que de leur offrir un bouton qui échoue.
  const canSetTrusted = ROLE_GROUPS.MANAGER_PLUS.includes(session.user.role);
  const { id } = await params;

  const [data, card] = await Promise.all([getCustomer(id), getLoyaltyCard(id)]);
  if (!data) notFound();
  const { customer, orders, stats } = data;

  return (
    <div className="space-y-6">
      <div>
        <BackButton
          fallbackHref="/dashboard/clients"
          label="Clients"
          className="-ml-3 mb-2"
        />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">
                {customer.name ?? 'Client'}
              </h1>
              {customer.isTrusted && (
                <Badge className="bg-blue-600">
                  <Handshake className="h-3 w-3" aria-hidden="true" />
                  Confiance
                </Badge>
              )}
            </div>
            <p className="font-mono text-sm text-muted-foreground">
              {formatPhoneForDisplay(customer.phone)}
            </p>
            {customer.dateOfBirth && (
              <p className="text-sm text-muted-foreground">
                🎂 Né(e) le {dobFmt.format(customer.dateOfBirth)}
              </p>
            )}
            {customer.isTrusted && customer.trustedNote && (
              <p className="mt-1 text-sm text-muted-foreground">
                {customer.trustedNote}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <MergeCustomerSheet
              customerId={customer.id}
              customerName={customer.name}
              customerPhone={customer.phone}
            />
            <CustomerFormSheet
              mode="edit"
              id={customer.id}
              name={customer.name}
              phone={customer.phone}
              dateOfBirth={
                customer.dateOfBirth
                  ? customer.dateOfBirth.toISOString().slice(0, 10)
                  : null
              }
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Mini label="Commandes" value={String(stats.ordersCount)} />
        <Mini
          label="Total dépensé"
          value={`${priceFmt.format(stats.totalSpent)} F`}
        />
        <Mini
          label="Dernière commande"
          value={stats.lastOrderAt ? dateFmt.format(stats.lastOrderAt) : '—'}
        />
      </div>

      {canSetTrusted && (
        <TrustedCustomerCard
          customerId={customer.id}
          isTrusted={customer.isTrusted}
          trustedSince={customer.trustedSince}
          trustedNote={customer.trustedNote}
        />
      )}

      {card && card.settings.enabled && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-base">Carte de fidélité</CardTitle>
            <MissedOrderStampsSheet customerId={customer.id} />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold tabular-nums">
                {card.stampCount}/{card.settings.stampsPerCard}
              </span>
              <span className="text-sm text-muted-foreground">
                tampons sur la carte en cours
              </span>
            </div>
            {card.availableRewards.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {card.availableRewards.map((r) => (
                  <Badge key={r.id} className="bg-green-600">
                    🎁 Récompense dispo — jusqu&apos;à{' '}
                    {priceFmt.format(r.capAmount)} F
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Aucune récompense en attente.
              </p>
            )}
          </CardContent>
        </Card>
      )}

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
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}
