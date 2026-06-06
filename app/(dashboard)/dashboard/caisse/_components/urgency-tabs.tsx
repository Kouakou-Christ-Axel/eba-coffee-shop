'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CountBadge } from './count-badge';
import { CaisseOrderList } from './caisse-order-list';
import type { CashierOrder } from '@/lib/cashier-queue';
import type { MenuCategory } from '@/config/menu';
import type { TabKey } from '../urgency';

type Counts = Record<TabKey, { total: number; critical: number }>;

type Props = {
  tab: TabKey;
  onTabChange: (tab: TabKey) => void;
  counts: Counts;
  visibleOrders: CashierOrder[];
  menu: MenuCategory[];
  now: Date;
};

const TAB_ORDER: TabKey[] = ['to-pay', 'in-progress', 'ready'];

export function UrgencyTabs({
  tab,
  onTabChange,
  counts,
  visibleOrders,
  menu,
  now,
}: Props) {
  return (
    <Tabs
      value={tab}
      onValueChange={(v) => onTabChange(v as TabKey)}
      className="flex-1"
    >
      <TabsList className="w-full">
        <TabsTrigger value="to-pay" className="flex-1 gap-1.5">
          À encaisser
          <CountBadge
            value={counts['to-pay'].total}
            criticalCount={counts['to-pay'].critical}
          />
        </TabsTrigger>
        <TabsTrigger value="in-progress" className="flex-1 gap-1.5">
          En cours
          <CountBadge
            value={counts['in-progress'].total}
            criticalCount={counts['in-progress'].critical}
            muted
          />
        </TabsTrigger>
        <TabsTrigger value="ready" className="flex-1 gap-1.5">
          Prêtes
          <CountBadge
            value={counts.ready.total}
            criticalCount={counts.ready.critical}
            muted
          />
        </TabsTrigger>
      </TabsList>

      {TAB_ORDER.map((t) => (
        <TabsContent key={t} value={t} className="mt-4">
          <CaisseOrderList
            orders={visibleOrders}
            tab={t}
            menu={menu}
            now={now}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}
