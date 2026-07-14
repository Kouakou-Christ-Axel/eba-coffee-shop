import { Skeleton } from '@/components/ui/skeleton';

// Skeleton isomorphe de la page de suivi de commande (même conteneur que
// app/(public)/commande/[id]/page.tsx : max-w-xl, pt-28/32).
export default function CommandeLoading() {
  return (
    <div className="mx-auto max-w-xl px-4 pb-12 pt-28 sm:pt-32">
      <div className="mb-6 space-y-2 text-center">
        <Skeleton className="mx-auto h-8 w-56" />
        <Skeleton className="mx-auto h-4 w-72" />
      </div>

      <Skeleton className="h-72 w-full rounded-2xl" />

      <div className="mt-8 text-center">
        <Skeleton className="mx-auto h-4 w-32" />
      </div>
    </div>
  );
}
