import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublicPoll } from '@/lib/polls';
import PollVoteSection from '@/components/(public)/sondages/poll-vote-section';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ pollId: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { pollId } = await params;
  const data = await getPublicPoll(pollId);
  if (!data) return {};
  return {
    title: data.poll.title,
    description: data.poll.description ?? 'Donne ton avis chez EBA Coffee Shop.',
    alternates: { canonical: `/sondages/${pollId}` },
  };
}

export default async function PollPage({ params }: Params) {
  const { pollId } = await params;
  const data = await getPublicPoll(pollId);
  if (!data) notFound();

  return (
    <PollVoteSection
      pollId={pollId}
      title={data.poll.title}
      description={data.poll.description}
      status={data.poll.status}
      allowSuggestions={data.poll.allowSuggestions}
      options={data.poll.options}
      results={data.results}
    />
  );
}
