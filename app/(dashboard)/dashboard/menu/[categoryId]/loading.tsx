import {
  PageHeaderSkeleton,
  TableSkeleton,
} from '@/components/(dashboard)/skeletons';

// Couvre aussi produits/[productId] et produits/new (segments enfants sans
// loading.tsx propre : ce boundary Suspense s'applique à tout le sous-arbre).
export default function CategoryProductsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton actions={1} withSubtitle={false} />
      <TableSkeleton rows={8} withHeader={false} />
    </div>
  );
}
