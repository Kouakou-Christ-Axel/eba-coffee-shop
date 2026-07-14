import { PageHeaderSkeleton } from '@/components/(dashboard)/skeletons';

// Le contenu est désormais streamé section par section (résumé, alerte stock
// bas, barre d'outils, onglets — cf. page.tsx et _components/), chacune avec
// son propre fallback `<Suspense>`. Ce loading.tsx ne couvre que la coquille
// initiale.
export default function InventaireLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withSubtitle />
    </div>
  );
}
