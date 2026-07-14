import { MediaImage as Image } from '@/components/ui/media-image';
import { notFound } from 'next/navigation';
import { requireRoleOrAnalyst } from '@/lib/auth-helpers';
import { getPollAdmin, listSuggestionsAdmin } from '@/lib/polls';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PollDetail } from './poll-detail';
import { EditPollSheet } from '../edit-poll-sheet';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ pollId: string }> };

export default async function PollDetailPage({ params }: Params) {
  await requireRoleOrAnalyst(['ADMIN']);
  const { pollId } = await params;

  const [data, { suggestions }] = await Promise.all([
    getPollAdmin(pollId),
    listSuggestionsAdmin({ pollId }),
  ]);
  if (!data) notFound();

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
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {data.poll.imageUrl && (
            <Image
              src={data.poll.imageUrl}
              alt={data.poll.title}
              width={64}
              height={64}
              className="size-16 shrink-0 rounded-lg object-cover"
            />
          )}
          <div>
            <h1 className="text-2xl font-bold">{data.poll.title}</h1>
            {data.poll.description && (
              <p className="text-sm text-muted-foreground">
                {data.poll.description}
              </p>
            )}
          </div>
        </div>
        <EditPollSheet
          poll={{
            id: data.poll.id,
            title: data.poll.title,
            description: data.poll.description,
            imageUrl: data.poll.imageUrl,
            allowSuggestions: data.poll.allowSuggestions,
            resultsVisibility: data.poll.resultsVisibility,
          }}
          variant="button"
        />
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
