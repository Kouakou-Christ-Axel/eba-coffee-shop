import { Skeleton } from '@/components/ui/skeleton';
import {
  PageHeaderSkeleton,
  KpiGridSkeleton,
  TableSkeleton,
} from '@/components/(dashboard)/skeletons';

export default function InventaireLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withSubtitle />

      <KpiGridSkeleton count={4} cols={4} />

      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-48" />
      </div>

      <Skeleton className="h-9 w-full max-w-md" />

      <TableSkeleton rows={10} withHeader={false} />
    </div>
  );
}
