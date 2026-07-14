import { Skeleton } from '@/components/ui/skeleton';

// Skeleton isomorphe de PollsListSection (content-container + liste de
// cartes) — affiché pendant le rendu serveur de la liste des sondages.
export default function SondagesLoading() {
  return (
    <section className="content-container px-6 py-16 md:py-24">
      <div className="mx-auto max-w-3xl space-y-3 text-center">
        <Skeleton className="mx-auto h-9 w-48" />
        <Skeleton className="mx-auto h-4 w-80" />
      </div>

      <div className="mx-auto mt-10 max-w-2xl space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
    </section>
  );
}
