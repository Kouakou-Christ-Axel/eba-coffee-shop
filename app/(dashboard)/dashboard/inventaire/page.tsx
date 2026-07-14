import { Suspense } from 'react';
import { requireRoleOrAnalyst, ROLE_GROUPS } from '@/lib/auth-helpers';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  KpiGridSkeleton,
  TableSkeleton,
} from '@/components/(dashboard)/skeletons';
import { SummarySection } from './_components/summary-section';
import { LowStockSection } from './_components/low-stock-section';
import { ToolbarSection } from './_components/toolbar-section';
import { ReferencesSection } from './_components/references-section';
import { CountSection } from './_components/count-section';
import { RestockSection } from './_components/restock-section';
import { HistorySection } from './_components/history-section';

export const dynamic = 'force-dynamic';

export default async function InventairePage() {
  await requireRoleOrAnalyst(ROLE_GROUPS.KITCHEN_PLUS);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Inventaire</h1>
        <p className="text-sm text-muted-foreground">
          Suivi du stock (matières premières &amp; consommables) — inventaire
          périodique.
        </p>
      </div>

      <Suspense fallback={<KpiGridSkeleton count={4} cols={4} />}>
        <SummarySection />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-16 rounded-xl" />}>
        <LowStockSection />
      </Suspense>

      <Suspense
        fallback={
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-9 w-40" />
          </div>
        }
      >
        <ToolbarSection />
      </Suspense>

      <Tabs defaultValue="references">
        <TabsList>
          <TabsTrigger value="references">Références</TabsTrigger>
          <TabsTrigger value="count">Inventaire</TabsTrigger>
          <TabsTrigger value="restock">Réappro</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
        </TabsList>

        <TabsContent value="references">
          <Suspense fallback={<TableSkeleton rows={10} withHeader={false} />}>
            <ReferencesSection />
          </Suspense>
        </TabsContent>

        <TabsContent value="count">
          <Suspense fallback={<TableSkeleton rows={10} withHeader={false} />}>
            <CountSection />
          </Suspense>
        </TabsContent>

        <TabsContent value="restock">
          <Suspense fallback={<TableSkeleton rows={10} withHeader={false} />}>
            <RestockSection />
          </Suspense>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Suspense
            fallback={
              <div className="space-y-6">
                <Skeleton className="h-64 rounded-xl" />
                <Skeleton className="h-64 rounded-xl" />
              </div>
            }
          >
            <HistorySection />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
