import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { JekoAccount } from '@/lib/jeko/accounts';
import { fetchRemoteBalance, type RemoteBalanceView } from '@/lib/jeko/balance';
import { jekoConfig } from '@/lib/jeko/config';
import type { getJekoLedger } from '@/lib/jeko/ledger';
import { BalanceCompare } from './balance-compare';

const fmt = new Intl.NumberFormat('fr-FR');
const f = (n: number) => `${fmt.format(n)} F`;

type Ledger = Awaited<ReturnType<typeof getJekoLedger>>;

/** Somme les soldes réels des comptes du périmètre ; le premier incident l'emporte. */
function combine(views: { account: JekoAccount; view: RemoteBalanceView }[]): {
  view: RemoteBalanceView;
  detail?: string;
} {
  const problem = views.find((v) => v.view.kind !== 'ok');
  if (problem) return { view: problem.view };
  const oks = views as {
    account: JekoAccount;
    view: { kind: 'ok'; balanceFcfa: number };
  }[];
  return {
    view: {
      kind: 'ok',
      balanceFcfa: oks.reduce((s, v) => s + v.view.balanceFcfa, 0),
    },
    detail:
      oks.length > 1
        ? oks.map((v) => `${v.account} : ${f(v.view.balanceFcfa)}`).join(' · ')
        : undefined,
  };
}

/** Lecture chez Jèko (réseau) : streamée à part pour ne pas retarder le reste. */
async function RemoteBalanceCard({
  scope,
  expected,
}: {
  scope: JekoAccount[];
  expected: number;
}) {
  const views = await Promise.all(
    scope.map(async (account) => ({
      account,
      view: await fetchRemoteBalance(jekoConfig(account)),
    }))
  );
  const { view, detail } = combine(views);
  return <BalanceCompare remote={view} expected={expected} detail={detail} />;
}

/** Solde attendu, solde réel chez Jèko et retirable, sur le compte filtré (ou tous). */
export function BalanceSection({
  ledger,
  scope,
}: {
  ledger: Ledger;
  /** Comptes couverts par le filtre. */
  scope: JekoAccount[];
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Solde attendu
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{f(ledger.balance)}</div>
          <p className="text-xs text-muted-foreground">
            calculé d’après les commandes et retraits
          </p>
        </CardContent>
      </Card>
      <Suspense fallback={<Skeleton className="h-[116px] rounded-xl" />}>
        <RemoteBalanceCard scope={scope} expected={ledger.balance} />
      </Suspense>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Retirable au maximum
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{f(ledger.maxWithdrawable)}</div>
          <p className="text-xs text-muted-foreground">
            frais de retrait de 1,5 % compris
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
