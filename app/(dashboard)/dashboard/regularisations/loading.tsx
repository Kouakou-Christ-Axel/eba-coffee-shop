import {
  PageHeaderSkeleton,
  KpiGridSkeleton,
  TableSkeleton,
} from '@/components/(dashboard)/skeletons';

export default function RegularisationsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withSubtitle />
      <KpiGridSkeleton count={2} cols={3} />
      <TableSkeleton rows={8} />
    </div>
  );
}
