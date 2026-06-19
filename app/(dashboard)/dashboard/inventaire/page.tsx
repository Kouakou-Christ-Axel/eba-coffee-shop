import {
  AlertTriangle,
  Boxes,
  ClipboardList,
  Coins,
  Download,
  FileSpreadsheet,
} from 'lucide-react';
import { requireKitchen } from '@/lib/auth-helpers';
import {
  listInventoryItems,
  getInventorySummary,
  listInventoryCategories,
  listRestockBatches,
  listInventoryCounts,
  getDaysSinceLastCount,
} from '@/lib/inventory';
import { listExpenseCategories } from '@/lib/expenses';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InventoryTable } from './inventory-table';
import { LowStockAlert } from './low-stock-alert';
import { InventoryCountGrid } from './inventory-count-grid';
import { RestockGrid } from './restock-grid';
import { CountHistory } from './count-history';
import { RestockBatches } from './restock-batches';
import { ImportDialog } from './import-dialog';

export const dynamic = 'force-dynamic';

const priceFmt = new Intl.NumberFormat('fr-FR');

export default async function InventairePage() {
  await requireKitchen();

  const [items, summary, categories, expenseCats, batches, counts, daysSince] =
    await Promise.all([
      listInventoryItems(),
      getInventorySummary(),
      listInventoryCategories(),
      listExpenseCategories(),
      listRestockBatches(),
      listInventoryCounts(),
      getDaysSinceLastCount(),
    ]);

  const expenseCategories = expenseCats.map((c) => ({
    id: c.id,
    name: c.name,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Inventaire</h1>
        <p className="text-sm text-muted-foreground">
          Suivi du stock (matières premières &amp; consommables) — inventaire
          périodique.
        </p>
      </div>

      {daysSince !== null && daysSince > 7 && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
            <p className="text-sm font-medium text-destructive">
              Dernier inventaire il y a {daysSince} jours — pensez à enregistrer
              un comptage.
            </p>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Références actives"
          value={priceFmt.format(summary.activeCount)}
          Icon={Boxes}
        />
        <Kpi
          label="Sous le seuil"
          value={priceFmt.format(summary.lowStockCount)}
          Icon={AlertTriangle}
          valueClassName={
            summary.lowStockCount > 0 ? 'text-destructive' : undefined
          }
        />
        <Kpi
          label="Valeur du stock"
          value={`${priceFmt.format(summary.stockValue)} F`}
          Icon={Coins}
        />
        <Kpi
          label="Jamais compté"
          value={priceFmt.format(summary.neverCounted)}
          Icon={ClipboardList}
        />
      </div>

      <LowStockAlert items={items.filter((i) => i.isLowStock)} />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <a href="/api/export/inventory">
            <Download className="mr-1.5 h-4 w-4" />
            Exporter Excel
          </a>
        </Button>
        <Button asChild variant="outline" size="sm">
          <a href="/api/inventory/import-template">
            <FileSpreadsheet className="mr-1.5 h-4 w-4" />
            Modèle d&apos;import
          </a>
        </Button>
        <ImportDialog expenseCategories={expenseCategories} />
      </div>

      <Tabs defaultValue="references">
        <TabsList>
          <TabsTrigger value="references">Références</TabsTrigger>
          <TabsTrigger value="count">Inventaire</TabsTrigger>
          <TabsTrigger value="restock">Réappro</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
        </TabsList>

        <TabsContent value="references">
          <InventoryTable items={items} categories={categories} />
        </TabsContent>

        <TabsContent value="count">
          <InventoryCountGrid items={items} />
        </TabsContent>

        <TabsContent value="restock">
          <RestockGrid items={items} expenseCategories={expenseCategories} />
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Historique des comptages
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CountHistory counts={counts} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Réapprovisionnements</CardTitle>
            </CardHeader>
            <CardContent>
              <RestockBatches batches={batches} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  Icon,
  valueClassName,
}: {
  label: string;
  value: string;
  hint?: string;
  Icon: typeof Boxes;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p
        className={cn(
          'mt-2 truncate text-2xl font-bold tabular-nums',
          valueClassName
        )}
      >
        {value}
      </p>
      {hint && (
        <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}
