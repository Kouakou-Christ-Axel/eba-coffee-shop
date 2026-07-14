// Skeleton isomorphe de IncontournablesSection (grid grid-cols-1 sm:grid-cols-2
// lg:grid-cols-3, cartes image h-72 md:h-80 — cf. incontournables-section-client.tsx).

import { Skeleton } from '@/components/ui/skeleton';

const CARD_COUNT = 6;

export default function IncontournablesSkeleton() {
  return (
    <section className="bg-background py-14 md:py-20" aria-hidden="true">
      <div className="content-container px-6">
        <div className="mb-8 space-y-3 md:mb-10">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-72 max-w-full" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: CARD_COUNT }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-72 w-full rounded-2xl md:h-80" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
