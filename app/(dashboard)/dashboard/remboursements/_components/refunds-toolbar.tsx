'use client';

// Onglets (files de travail + historique), filtre de canal et, pour l'historique,
// la plage de dates. Pastilles de comptage : ce qui attend une action se voit
// sans ouvrir l'onglet.

import { Select, SelectItem } from '@heroui/react';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DateRangeFilter } from '@/components/(dashboard)/date-range-filter';
import { PAYMENT_MODES, PAYMENT_MODE_LABELS } from '@/lib/payment-modes';
import { rangeChangeToParams } from '@/lib/url-state/shared-params';
import type { PaymentMode } from '@/generated/prisma/client';
import { REFUND_TABS, type RefundTab } from '../search-params';
import {
  RefundsNavProvider,
  useRefundsNav,
  useRefundsNavValue,
} from './use-refunds-nav';

const TAB_LABELS: Record<RefundTab, string> = {
  validate: 'À valider',
  fix: 'À corriger',
  progress: 'En cours',
  history: 'Historique',
};

type Props = {
  counts: { toApprove: number; toFix: number; inProgress: number };
  from: string;
  to: string;
  isAll: boolean;
};

function TabsRow({ counts }: { counts: Props['counts'] }) {
  const { filters, update } = useRefundsNav();
  const badge: Partial<Record<RefundTab, number>> = {
    validate: counts.toApprove,
    fix: counts.toFix,
    progress: counts.inProgress,
  };
  return (
    <div className="min-w-0 max-w-full overflow-x-auto">
      <Tabs
        value={filters.tab}
        onValueChange={(v) => update({ tab: v as RefundTab })}
        className="w-fit"
      >
        <TabsList>
          {REFUND_TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab} className="gap-1.5">
              {TAB_LABELS[tab]}
              {(badge[tab] ?? 0) > 0 && (
                <span
                  className={cn(
                    'rounded-full px-1.5 text-xs font-semibold tabular-nums',
                    tab === 'fix'
                      ? 'bg-destructive text-white'
                      : 'bg-primary text-primary-foreground'
                  )}
                >
                  {badge[tab]}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}

function ChannelFilter() {
  const { filters, update } = useRefundsNav();
  return (
    <Select
      aria-label="Filtrer par canal"
      size="sm"
      variant="bordered"
      radius="md"
      selectedKeys={[filters.channel ?? 'all']}
      disallowEmptySelection
      className="w-full min-w-0 sm:w-[170px]"
      onSelectionChange={(keys) => {
        if (keys === 'all') return;
        const next = String(Array.from(keys)[0] ?? 'all');
        update({ channel: next === 'all' ? null : (next as PaymentMode) });
      }}
    >
      {[
        <SelectItem key="all">Tous les canaux</SelectItem>,
        ...PAYMENT_MODES.map((m) => (
          <SelectItem key={m}>{PAYMENT_MODE_LABELS[m]}</SelectItem>
        )),
      ]}
    </Select>
  );
}

export function RefundsToolbar({ counts, from, to, isAll }: Props) {
  const nav = useRefundsNavValue();
  return (
    <RefundsNavProvider value={nav}>
      <div
        aria-busy={nav.isPending}
        className={cn(
          'space-y-4 transition-opacity',
          nav.isPending && 'pointer-events-none opacity-60'
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsRow counts={counts} />
          <ChannelFilter />
        </div>
        {nav.filters.tab === 'history' && (
          <DateRangeFilter
            from={from}
            to={to}
            isAll={isAll}
            onRangeChange={(next) => nav.update(rangeChangeToParams(next))}
          />
        )}
      </div>
    </RefundsNavProvider>
  );
}
