import {
  PageHeaderSkeleton,
  KpiGridSkeleton,
  ChartCardSkeleton,
  TableSkeleton,
} from '@/components/(dashboard)/skeletons';

export default function InvestissementsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton actions={1} />
      <KpiGridSkeleton count={4} cols={4} />
      <ChartCardSkeleton height={280} />
      <TableSkeleton rows={8} />
    </div>
  );
}
