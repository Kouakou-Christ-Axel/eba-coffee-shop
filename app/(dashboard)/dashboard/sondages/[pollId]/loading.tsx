import { Skeleton } from '@/components/ui/skeleton';
import { TableSkeleton } from '@/components/(dashboard)/skeletons';

export default function PollDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Skeleton className="size-16 shrink-0 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <Skeleton className="h-9 w-28" />
      </div>

      <TableSkeleton rows={4} withToolbar={false} />
    </div>
  );
}
