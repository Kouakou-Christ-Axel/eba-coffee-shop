import {
  PageHeaderSkeleton,
  TableSkeleton,
} from '@/components/(dashboard)/skeletons';

export default function UtilisateursLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withSubtitle />
      <TableSkeleton rows={6} withToolbar={false} />
    </div>
  );
}
