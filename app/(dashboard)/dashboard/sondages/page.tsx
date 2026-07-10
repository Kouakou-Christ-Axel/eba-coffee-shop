import { Vote } from 'lucide-react';
import { requireRoleOrAnalyst } from '@/lib/auth-helpers';
import { getPollsAdmin } from '@/lib/polls';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PollsTable } from './polls-table';

export const dynamic = 'force-dynamic';

export default async function SondagesPage() {
  await requireRoleOrAnalyst(['ADMIN']);

  const { polls } = await getPollsAdmin();
  const rows = polls.map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    imageUrl: p.imageUrl,
    status: p.status,
    allowSuggestions: p.allowSuggestions,
    resultsVisibility: p.resultsVisibility,
    optionsCount: p.optionsCount,
    votesCount: p.votesCount,
    pendingSuggestionsCount: p.pendingSuggestionsCount,
  }));

  const totalPending = rows.reduce(
    (sum, p) => sum + p.pendingSuggestionsCount,
    0
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sondages</h1>
        <p className="text-sm text-muted-foreground">
          Sonde tes clients sur n’importe quel sujet — la pâtisserie de la
          semaine, ou toute autre question.
        </p>
      </div>

      {totalPending > 0 && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="flex items-center gap-3 py-4">
            <Vote className="h-5 w-5 shrink-0 text-primary" />
            <p className="text-sm font-medium">
              {totalPending} suggestion{totalPending > 1 ? 's' : ''} de la
              communauté en attente de modération.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tous les sondages</CardTitle>
        </CardHeader>
        <CardContent>
          <PollsTable polls={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
