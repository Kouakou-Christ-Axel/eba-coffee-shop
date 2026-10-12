'use client';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOrdersNav, type OrdersFilters } from './use-orders-nav';

const TABS = [
  { value: 'all', label: 'Toutes' },
  { value: 'NEW', label: 'Nouvelles' },
  { value: 'PREPARING', label: 'En cours' },
  { value: 'READY', label: 'Prêtes' },
  { value: 'COMPLETED', label: 'Récupérées' },
  { value: 'CANCELLED', label: 'Annulées' },
];

export function StatusTabs() {
  const { filters, update } = useOrdersNav();

  const handleChange = (value: string) => {
    update({
      status: value === 'all' ? null : (value as OrdersFilters['status']),
    });
  };

  // Conteneur à scroll horizontal : sur mobile les 6 onglets ne tiennent pas
  // dans le viewport ; sans ça le `TabsList` (largeur fixe, `whitespace-nowrap`)
  // déborde et élargit toute la page. `min-w-0 max-w-full` le contraint à la
  // largeur disponible, `overflow-x-auto` scrolle localement au lieu de casser
  // la mise en page. Sur desktop les onglets tiennent : pas de barre de scroll.
  return (
    <div className="min-w-0 max-w-full overflow-x-auto">
      <Tabs
        value={filters.status ?? 'all'}
        onValueChange={handleChange}
        className="w-fit"
      >
        <TabsList>
          {TABS.map(({ value, label }) => (
            <TabsTrigger key={value} value={value}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
