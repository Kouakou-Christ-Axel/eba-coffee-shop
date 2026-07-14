import { Skeleton } from '@/components/ui/skeleton';
import {
  FormSkeleton,
  TableSkeleton,
} from '@/components/(dashboard)/skeletons';

export default function MenuLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-16 rounded-xl" />
      <FormSkeleton fields={2} />
      <TableSkeleton rows={8} withHeader={false} />
    </div>
  );
}
