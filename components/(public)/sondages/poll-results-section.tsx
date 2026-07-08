'use client';

type PollResultOption = {
  optionId: string;
  label: string;
  votes: number;
  percentage: number;
};

/**
 * N'affiche que ce que le serveur a transmis (`results`) : si le sondage ne
 * doit pas encore montrer ses décomptes, `results` est `null` — on ne fait
 * jamais de calcul côté client à partir de données qu'on n'a pas reçues.
 */
function PollResultsSection({
  results,
}: {
  results: { totalVotes: number; options: PollResultOption[] } | null;
}) {
  if (!results) return null;

  return (
    <div className="space-y-3 rounded-2xl border border-default-200/70 bg-background/80 p-5">
      <p className="text-sm font-medium text-muted-foreground">
        {results.totalVotes} vote{results.totalVotes > 1 ? 's' : ''}
      </p>
      {results.options.map((o) => (
        <div key={o.optionId}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-medium">{o.label}</span>
            <span className="tabular-nums text-muted-foreground">
              {o.percentage}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-default-200">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${o.percentage}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default PollResultsSection;
