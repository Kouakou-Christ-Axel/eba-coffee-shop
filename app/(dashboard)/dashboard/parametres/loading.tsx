import { Skeleton } from '@/components/ui/skeleton';
import { FormSkeleton } from '@/components/(dashboard)/skeletons';

export default function ParametresLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <FormSkeleton fields={4} />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <FormSkeleton fields={3} />
      </div>
    </div>
  );
}
