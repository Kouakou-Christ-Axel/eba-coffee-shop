import { PageHeaderSkeleton } from '@/components/(dashboard)/skeletons';

// Le contenu est désormais streamé section par section (today-kpis, trend,
// low-stock — cf. page.tsx), chacune avec son propre fallback `<Suspense>`.
export default function DashboardHomeLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton actions={3} />
    </div>
  );
}
