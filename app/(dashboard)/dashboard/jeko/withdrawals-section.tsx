import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { JekoAccount } from '@/lib/jeko/accounts';
import type { getJekoLedger } from '@/lib/jeko/ledger';
import { DeleteWithdrawalButton, WithdrawalForm } from './withdrawal-form';

const fmt = new Intl.NumberFormat('fr-FR');
const f = (n: number) => `${fmt.format(n)} F`;

type Ledger = Awaited<ReturnType<typeof getJekoLedger>>;

/** Formulaire de retrait et liste des retraits du compte filtré (ou de tous). */
export function WithdrawalsSection({
  ledger,
  accounts,
  fixedAccount,
  balances,
  canWrite,
}: {
  ledger: Ledger;
  accounts: JekoAccount[];
  fixedAccount: JekoAccount | null;
  balances: Record<JekoAccount, number>;
  canWrite: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Retraits</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {canWrite && (
          <WithdrawalForm
            accounts={accounts}
            fixedAccount={fixedAccount}
            balances={balances}
          />
        )}
        {ledger.withdrawals.length > 0 ? (
          <ul className="divide-y text-sm">
            {ledger.withdrawals.map((w) => (
              <li key={w.id} className="flex items-center justify-between py-2">
                <span>
                  {w.createdAt.toLocaleDateString('fr-FR')}
                  {fixedAccount === null && ` · compte ${w.jekoAccount}`} ·{' '}
                  {f(w.amount)} + {f(w.fee)} de frais
                  {w.note && (
                    <span className="text-muted-foreground"> · {w.note}</span>
                  )}
                </span>
                {canWrite && <DeleteWithdrawalButton id={w.id} />}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aucun retrait enregistré.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
