import { PageHeaderSkeleton } from '@/components/(dashboard)/skeletons';

// Le shell (header + filtres) rend vite ; le contenu est désormais streamé
// section par section (chaque section a son propre fallback `<Suspense>`,
// cf. page.tsx). Ce loading.tsx ne couvre donc plus que la coquille initiale
// (guard de session + parsing des searchParams côté page).
export default function StatistiquesLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton actions={3} />
    </div>
  );
}
