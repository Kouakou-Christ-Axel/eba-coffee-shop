import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RemoteBalanceView } from '@/lib/jeko/balance';

const fmt = new Intl.NumberFormat('fr-FR');
const f = (n: number) => `${fmt.format(n)} F`;

/** Solde réel lu chez Jèko, comparé au solde attendu calculé ici. */
export function BalanceCompare({
  remote,
  expected,
}: {
  remote: RemoteBalanceView;
  expected: number;
}) {
  const gap = remote.kind === 'ok' ? remote.balanceFcfa - expected : null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Solde réel chez Jèko
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {remote.kind === 'ok' && gap !== null && (
          <>
            <div className="text-3xl font-bold">{f(remote.balanceFcfa)}</div>
            <p
              className={
                gap === 0
                  ? 'text-xs text-muted-foreground'
                  : 'text-xs font-medium text-amber-600'
              }
            >
              {gap === 0
                ? 'identique au solde attendu'
                : `écart de ${gap > 0 ? '+' : '−'}${f(Math.abs(gap))} avec le solde attendu`}
            </p>
          </>
        )}
        {remote.kind === 'unconfigured' && (
          <p className="text-sm text-muted-foreground">
            Clés de ce compte non configurées.
          </p>
        )}
        {remote.kind === 'error' && (
          <p className="text-sm text-destructive">
            Lecture impossible : {remote.message}
          </p>
        )}
        {remote.kind === 'unknown' && (
          <p className="break-all text-xs text-muted-foreground">
            Réponse Jèko non reconnue : {remote.raw}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
