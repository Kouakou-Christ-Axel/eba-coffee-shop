import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  JEKO_MONTHLY_LIMIT_FCFA,
  JEKO_MONTHLY_WARN_RATIO,
} from '@/config/constants';
import type { JekoAccount } from '@/lib/jeko/accounts';
import type { RemoteBalanceView } from '@/lib/jeko/balance';
import type { getJekoLedger } from '@/lib/jeko/ledger';
import { BalanceCompare } from './balance-compare';
import { DeleteWithdrawalButton, WithdrawalForm } from './withdrawal-form';

const fmt = new Intl.NumberFormat('fr-FR');
const f = (n: number) => `${fmt.format(n)} F`;

type Ledger = Awaited<ReturnType<typeof getJekoLedger>>;

export function AccountSection({
  account,
  active,
  ledger: l,
  remote,
  canWrite,
}: {
  account: JekoAccount;
  active: boolean;
  ledger: Ledger;
  remote: RemoteBalanceView;
  canWrite: boolean;
}) {
  const lines: [string, string, string?][] = [
    ['Payé par les clients', f(l.collected), `${l.count} paiement(s)`],
    ['dont frais clients (1 %)', f(l.customerFees)],
    ['Frais prélevés par Jèko', f(-l.gatewayFees)],
    ['Remboursements envoyés (frais compris)', f(-l.refunded)],
    ['Net arrivé sur Jèko', f(l.netReceived)],
    ['Retraits', f(-l.withdrawnTotal)],
    ['Frais de retrait', f(-l.withdrawalFeesTotal)],
  ];
  const nearLimit =
    l.monthCollected >= JEKO_MONTHLY_LIMIT_FCFA * JEKO_MONTHLY_WARN_RATIO;

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">
        Compte {account}
        {active && (
          <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            actif
          </span>
        )}
      </h2>

      {nearLimit && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          {f(l.monthCollected)} encaissés ce mois sur un plafond mensuel Jèko de{' '}
          {f(JEKO_MONTHLY_LIMIT_FCFA)}
          {active
            ? ' : passez sur l’autre compte avant la limite (un retrait ne libère pas de place).'
            : '.'}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Solde attendu
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{f(l.balance)}</div>
            <p className="text-xs text-muted-foreground">
              calculé d’après les commandes et retraits
            </p>
          </CardContent>
        </Card>
        <BalanceCompare remote={remote} expected={l.balance} />
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Encaissé ce mois
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{f(l.monthCollected)}</div>
            <p className="text-xs text-muted-foreground">
              plafond mensuel {f(JEKO_MONTHLY_LIMIT_FCFA)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Retirable au maximum
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{f(l.maxWithdrawable)}</div>
            <p className="text-xs text-muted-foreground">
              frais de retrait compris
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Coût net pour EBA (encaissement)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{f(l.absorbedFees)}</div>
            <p className="text-xs text-muted-foreground">
              frais Jèko − frais payés par les clients
            </p>
          </CardContent>
        </Card>
      </div>

      {l.feeUnknownCount > 0 && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          {l.feeUnknownCount} paiement(s) n’ont pas leurs frais Jèko : le solde
          attendu peut être trop haut tant que le webhook ou la vérification n’a
          pas complété ces commandes.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Détail</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="divide-y text-sm">
            {lines.map(([label, value, hint]) => (
              <div key={label} className="flex justify-between py-2">
                <dt>
                  {label}
                  {hint && (
                    <span className="ml-2 text-muted-foreground">{hint}</span>
                  )}
                </dt>
                <dd className="font-medium tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Enregistrer un retrait</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {canWrite && (
            <WithdrawalForm
              maxWithdrawable={l.maxWithdrawable}
              account={account}
            />
          )}
          {l.withdrawals.length > 0 && (
            <ul className="divide-y text-sm">
              {l.withdrawals.map((w) => (
                <li
                  key={w.id}
                  className="flex items-center justify-between py-2"
                >
                  <span>
                    {w.createdAt.toLocaleDateString('fr-FR')} · {f(w.amount)} +{' '}
                    {f(w.fee)} de frais
                    {w.note && (
                      <span className="text-muted-foreground"> · {w.note}</span>
                    )}
                  </span>
                  {canWrite && <DeleteWithdrawalButton id={w.id} />}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
