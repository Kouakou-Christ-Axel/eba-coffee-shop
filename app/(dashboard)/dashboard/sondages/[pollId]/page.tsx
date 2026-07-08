import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth-helpers';
import { getPollAdmin, listSuggestionsAdmin } from '@/lib/polls';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PollDetail } from './poll-detail';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ pollId: string }> };

export default async function PollDetailPage({ params }: Params) {
  await requireAdmin();
  const { pollId } = await params;

  const data = await getPollAdmin(pollId);
  if (!data) notFound();

  const { suggestions } = await listSuggestionsAdmin({ pollId });

  const options = data.poll.options.map((o) => ({
    id: o.id,
    label: o.label,
    description: o.description,
    imageUrl: o.imageUrl,
    deletedAt: o.deletedAt,
    votes: data.tallies.byOption.get(o.id) ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{data.poll.title}</h1>
        {data.poll.description && (
          <p className="text-sm text-muted-foreground">
            {data.poll.description}
          </p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Options ({data.tallies.totalVotes} vote
            {data.tallies.totalVotes > 1 ? 's' : ''} au total)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PollDetail
            pollId={pollId}
            options={options}
            totalVotes={data.tallies.totalVotes}
            suggestions={suggestions}
            allowSuggestions={data.poll.allowSuggestions}
          />
        </CardContent>
      </Card>
    </div>
  );
}
