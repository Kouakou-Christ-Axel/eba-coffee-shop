import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Réservation de place pendant le téléchargement du chunk `recharts`.
 *
 * Chaque graphe est chargé en `next/dynamic` (cf. les wrappers du dossier) :
 * ce placeholder occupe **exactement** la boîte du graphe final pour qu'aucun
 * contenu ne se décale à son arrivée. Décoratif, donc masqué aux lecteurs
 * d'écran : le titre de la carte porte déjà l'information.
 */
export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <Skeleton aria-hidden className={cn('w-full rounded-lg', className)} />
  );
}
