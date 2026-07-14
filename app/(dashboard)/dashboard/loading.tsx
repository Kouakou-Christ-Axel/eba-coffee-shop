import {
  PageHeaderSkeleton,
  KpiGridSkeleton,
  ChartCardSkeleton,
} from '@/components/(dashboard)/skeletons';

export default function DashboardHomeLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton actions={3} />

      <KpiGridSkeleton count={4} cols={4} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCardSkeleton height={300} />
        </div>
        <ChartCardSkeleton height={300} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ChartCardSkeleton height={180} />
        <ChartCardSkeleton height={180} />
      </div>

      <ChartCardSkeleton height={120} />
      <ChartCardSkeleton height={200} />
    </div>
  );
}
