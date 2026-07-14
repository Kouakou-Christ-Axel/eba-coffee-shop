// Skeleton isomorphe de CarteMenuSection : nav catégories (pills) + ancres de
// catégories avec grilles de cartes produit (mêmes dimensions que
// carte-menu-section-client.tsx : sm:grid-cols-2 lg:grid-cols-3, cartes
// ~24 (h-20/h-24 côté image)).

import { Skeleton } from '@/components/ui/skeleton';

const CATEGORY_COUNT = 4;
const CARDS_PER_CATEGORY = 6;

export default function CarteMenuSkeleton() {
  return (
    <section
      aria-hidden="true"
      className="bg-[linear-gradient(180deg,rgba(255,252,248,1)_0%,rgba(247,239,232,1)_100%)] pb-14 md:pb-20"
    >
      <div className="sticky top-16 z-30 border-b border-foreground/5 bg-background/90 backdrop-blur-sm">
        <div className="content-container">
          <nav className="flex gap-2 overflow-x-auto py-3">
            {Array.from({ length: CATEGORY_COUNT }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-24 shrink-0 rounded-full" />
            ))}
          </nav>
        </div>
      </div>

      <div className="content-container mt-6 space-y-10 md:mt-8 md:space-y-14">
        {Array.from({ length: CATEGORY_COUNT }).map((_, catIndex) => (
          <div key={catIndex}>
            <Skeleton className="h-7 w-40" />
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: CARDS_PER_CATEGORY }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
