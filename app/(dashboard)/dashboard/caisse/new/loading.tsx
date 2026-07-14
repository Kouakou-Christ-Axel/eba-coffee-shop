import { Skeleton } from '@/components/ui/skeleton';

// Nouvelle commande (POS) : même famille d'écran que /dashboard/caisse.
export default function NewOrderLoading() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col gap-4">
      <Skeleton className="h-9 w-56" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:col-span-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="space-y-3">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
