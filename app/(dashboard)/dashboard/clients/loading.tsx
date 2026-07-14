import {
  PageHeaderSkeleton,
  TableSkeleton,
} from '@/components/(dashboard)/skeletons';

export default function ClientsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton actions={2} />
      <TableSkeleton rows={10} withToolbar={false} />
    </div>
  );
}
