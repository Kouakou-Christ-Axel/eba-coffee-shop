import { Skeleton } from '@/components/ui/skeleton';
import { PageHeaderSkeleton } from '@/components/(dashboard)/skeletons';

export default function ArdoiseLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton actions={2} />
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-10 rounded-lg" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
