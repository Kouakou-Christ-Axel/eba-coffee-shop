import { getGlobalExtras } from '@/lib/menu';
import { GlobalExtrasForm } from './global-extras-form';

export default async function GlobalExtrasPage() {
  const groups = await getGlobalExtras();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Extras globaux</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Suppléments configurés une seule fois (ex. chantilly, sirops) et
          proposés automatiquement sur TOUS les produits, sans les rattacher un
          par un. Ils apparaissent en fin de liste dans le sélecteur de
          suppléments de chaque produit.
        </p>
      </div>

      <GlobalExtrasForm
        initialGroups={groups.map((g) => ({
          name: g.name,
          type: g.type,
          required: g.required,
          available: g.available,
          minSelect: g.minSelect,
          maxSelect: g.maxSelect,
          options: g.options.map((o) => ({
            name: o.name,
            price: o.price,
            available: o.available,
            stockQuantity: o.stockQuantity,
          })),
        }))}
      />
    </div>
  );
}
