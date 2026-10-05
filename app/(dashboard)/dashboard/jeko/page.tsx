import { requireRoleOrAnalyst } from '@/lib/auth-helpers';
import { getJekoLedger } from '@/lib/jeko/ledger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DeleteWithdrawalButton, WithdrawalForm } from './withdrawal-form';

export const dynamic = 'force-dynamic';

const fmt = new Intl.NumberFormat('fr-FR');
const f = (n: number) => `${fmt.format(n)} F`;

export default async function JekoPage() {
  await requireRoleOrAnalyst(['ADMIN']);
  const l = await getJekoLedger();

  const lines: [string, string, string?][] = [
    ['Payé par les clients', f(l.collected), `${l.count} paiement(s)`],
    ['dont frais clients (1 %)', f(l.customerFees)],
    ['Frais prélevés par Jèko', f(-l.gatewayFees)],
    ['Net arrivé sur Jèko', f(l.netReceived)],
    ['Retraits', f(-l.withdrawnTotal)],
    ['Frais de retrait', f(-l.withdrawalFeesTotal)],
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Solde Jèko</h1>
        <p className="text-sm text-muted-foreground">
          Ce qui doit se trouver sur le compte Jèko, d’après les paiements en
          ligne encaissés et les retraits enregistrés ici.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Solde attendu
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">
            {f(l.balance)}
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
          <WithdrawalForm maxWithdrawable={l.maxWithdrawable} />
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
                  <DeleteWithdrawalButton id={w.id} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
