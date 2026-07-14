import { Skeleton } from '@/components/ui/skeleton';

// Skeleton isomorphe de PollVoteSection (image + titre + options de vote).
export default function PollLoading() {
  return (
    <section className="content-container px-6 py-16 md:py-24">
      <div className="mx-auto max-w-xl">
        <Skeleton className="mx-auto h-40 w-full rounded-2xl" />
        <div className="mt-6 space-y-3 text-center">
          <Skeleton className="mx-auto h-8 w-64" />
          <Skeleton className="mx-auto h-4 w-80" />
        </div>
        <div className="mt-8 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="mt-6 h-12 w-full rounded-xl" />
      </div>
    </section>
  );
}
