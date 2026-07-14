import { Skeleton } from '@/components/ui/skeleton';
import {
  PageHeaderSkeleton,
  KpiGridSkeleton,
  ChartCardSkeleton,
} from '@/components/(dashboard)/skeletons';

export default function DepensesLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton actions={1} />

      <Skeleton className="h-9 w-full max-w-md" />

      <KpiGridSkeleton count={4} cols={4} />
      <ChartCardSkeleton height={280} />
      <ChartCardSkeleton height={280} />
    </div>
  );
}
