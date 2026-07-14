import { Skeleton } from '@/components/ui/skeleton';
import { PageHeaderSkeleton } from '@/components/(dashboard)/skeletons';

// Le contenu est désormais streamé section par section (alertes, onglets —
// cf. page.tsx et _components/), chacune avec son propre fallback
// `<Suspense>`. Ce loading.tsx ne couvre que la coquille initiale.
export default function DepensesLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton actions={1} />
      <Skeleton className="h-9 w-full max-w-md" />
    </div>
  );
}
