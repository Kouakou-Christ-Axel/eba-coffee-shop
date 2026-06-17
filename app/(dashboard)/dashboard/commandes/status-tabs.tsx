'use client';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOrdersNav } from './use-orders-nav';

const TABS = [
  { value: 'all', label: 'Toutes' },
  { value: 'NEW', label: 'Nouvelles' },
  { value: 'PREPARING', label: 'En cours' },
  { value: 'READY', label: 'Prêtes' },
  { value: 'COMPLETED', label: 'Récupérées' },
  { value: 'CANCELLED', label: 'Annulées' },
];

export function StatusTabs({ activeStatus }: { activeStatus?: string }) {
  const { navigate } = useOrdersNav();

  const handleChange = (value: string) => {
    navigate((params) => {
      if (value === 'all') params.delete('status');
      else params.set('status', value);
    });
  };

  return (
    <Tabs value={activeStatus ?? 'all'} onValueChange={handleChange}>
      <TabsList>
        {TABS.map(({ value, label }) => (
          <TabsTrigger key={value} value={value}>
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
