import { Skeleton } from '@/components/ui/skeleton';
import {
  PageHeaderSkeleton,
  TableSkeleton,
} from '@/components/(dashboard)/skeletons';

export default function ClientDetailLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton actions={2} />
      <Skeleton className="h-32 rounded-xl" />
      <TableSkeleton rows={6} withToolbar={false} />
    </div>
  );
}
