import {
  PageHeaderSkeleton,
  FormSkeleton,
  TableSkeleton,
} from '@/components/(dashboard)/skeletons';

export default function ClotureLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton actions={1} />
      <FormSkeleton fields={4} />
      <TableSkeleton rows={8} />
    </div>
  );
}
