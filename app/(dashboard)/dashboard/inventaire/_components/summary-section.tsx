import { AlertTriangle, Boxes, ClipboardList, Coins } from 'lucide-react';
import { getInventorySummary, getDaysSinceLastCount } from '@/lib/inventory';
import { getInventorySettings } from '@/lib/inventory-settings-db';
import { Card, CardContent } from '@/components/ui/card';
import { KpiCard } from '@/components/(dashboard)/kpi-card';

const priceFmt = new Intl.NumberFormat('fr-FR');

export async function SummarySection() {
  const [summary, daysSince, settings] = await Promise.all([
    getInventorySummary(),
    getDaysSinceLastCount(),
    getInventorySettings(),
  ]);

  // Le seuil est configurable (`InventorySettings.reminderDays`, déjà utilisé
  // par le rappel email) : la bannière doit dire la même chose que le mail.
  const overdue = daysSince !== null && daysSince > settings.reminderDays;

  // `stockValue` est une somme de `quantité × PMP`. Tant qu'aucune référence
  // n'a de PMP, elle vaut 0 — ce qui se lit comme un bug plutôt que comme une
  // absence de donnée. On affiche l'absence.
  const hasValuation = summary.valuedCount > 0;

  return (
    <>
      {overdue && (
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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Références actives"
          value={priceFmt.format(summary.activeCount)}
          Icon={Boxes}
        />
        <KpiCard
          label="Sous le seuil"
          value={priceFmt.format(summary.lowStockCount)}
          Icon={AlertTriangle}
          valueClassName={
            summary.lowStockCount > 0 ? 'text-destructive' : undefined
          }
        />
        <KpiCard
          label="Valeur du stock"
          value={
            hasValuation ? `${priceFmt.format(summary.stockValue)} F` : '—'
          }
          hint={
            hasValuation
              ? `${priceFmt.format(summary.valuedCount)} / ${priceFmt.format(summary.activeCount)} références valorisées`
              : 'PMP non renseigné — saisissez un réappro pour valoriser'
          }
          Icon={Coins}
          // `truncate` : à `grid-cols-2` sur téléphone, un montant à 7 chiffres
          // déborde de la carte.
          valueClassName="truncate"
        />
        <KpiCard
          label="Jamais compté"
          value={priceFmt.format(summary.neverCounted)}
          Icon={ClipboardList}
        />
      </div>
    </>
  );
}
