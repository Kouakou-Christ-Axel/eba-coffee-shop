import { notFound } from 'next/navigation';
import { Boxes, Coins, ListOrdered } from 'lucide-react';

import { requireRoleOrAnalyst, ROLE_GROUPS } from '@/lib/auth-helpers';
import { getInventoryCount } from '@/lib/inventory';
import { BackButton } from '@/components/(dashboard)/back-button';
import { KpiCard } from '@/components/(dashboard)/kpi-card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card } from '@/components/ui/card';

// Page d'administration : données live, jamais prérendue.
export const dynamic = 'force-dynamic';

const f = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });
const money = new Intl.NumberFormat('fr-FR');

const dayFmt = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function formatDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return dayFmt.format(new Date(Date.UTC(y, m - 1, d)));
}

export default async function ComptageDetailPage({
  params,
}: {
  params: Promise<{ countId: string }>;
}) {
  const { countId } = await params;
  await requireRoleOrAnalyst(ROLE_GROUPS.KITCHEN_PLUS);

  // `getInventoryCount` produisait déjà ce rapport valorisé — aucune page ne le
  // consommait, l'historique n'étant pas cliquable.
  const count = await getInventoryCount(countId);
  if (!count) notFound();

  return (
    <div className="space-y-6">
      <div>
        <BackButton
          fallbackHref="/dashboard/inventaire"
          label="Inventaire"
          className="-ml-3 mb-2"
        />
        <h1 className="text-xl font-bold">
          Comptage du {formatDay(count.date)}
        </h1>
        <p className="text-sm text-muted-foreground">
          {count.label ? `${count.label} · ` : ''}
          {count.lines.length} référence{count.lines.length > 1 ? 's' : ''}
          {count.by ? ` · par ${count.by}` : ''}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <KpiCard
          label="Références comptées"
          value={money.format(count.lines.length)}
          Icon={ListOrdered}
        />
        <KpiCard
          label="Valeur du stock compté"
          value={`${money.format(count.totals.stockValue)} F`}
          Icon={Boxes}
          valueClassName="truncate"
        />
        <KpiCard
          label="Consommation de la période"
          value={`${money.format(count.totals.consumptionValue)} F`}
          hint="Valorisée au PMP figé au comptage"
          Icon={Coins}
          valueClassName="truncate"
        />
      </div>

      {count.note && (
        <Card className="p-4 text-sm whitespace-pre-line">{count.note}</Card>
      )}

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Réf.</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead className="text-right">Ouverture</TableHead>
                <TableHead className="text-right">Achats</TableHead>
                <TableHead className="text-right">Compté</TableHead>
                <TableHead className="text-right">Consommation</TableHead>
                <TableHead className="text-right">Valeur</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {count.lines.map((line) => (
                <TableRow key={line.itemId}>
                  <TableCell className="font-mono text-xs whitespace-nowrap text-muted-foreground">
                    {line.item.sku}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {line.item.name}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {f.format(line.openingQuantity)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {f.format(line.purchasesQuantity)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {f.format(line.countedQuantity)} {line.item.unit}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {/* Une consommation négative n'est pas une sortie : c'est
                        une entrée qui n'a pas été enregistrée sur la période. */}
                    {line.consumption < 0 ? (
                      <span className="text-amber-700 dark:text-amber-400">
                        {f.format(line.consumption)}
                      </span>
                    ) : (
                      f.format(line.consumption)
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {money.format(line.consumptionValue)} F
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
